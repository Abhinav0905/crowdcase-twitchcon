import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root = resolve(import.meta.dirname,'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const rooms=new Map();
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
export function createAppServer(){return createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try {
    if(url.pathname.startsWith('/api/')){
      if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Use the local app origin.'});
      if(url.pathname==='/api/health')return send(res,200,{app:'CrowdCase',overlay:true});
      if(req.method==='POST'&&!String(req.headers['content-type']).includes('application/json'))return send(res,415,{error:'JSON required.'});
      if(url.pathname==='/api/rooms'&&req.method==='POST'){
        for(const [id,r]of rooms)if(Date.now()-r.updatedAt>6*3600000){for(const client of r.clients)client.end();rooms.delete(id);}
        if(rooms.size>=20)return send(res,429,{error:'Too many sessions.'});
        const id=randomBytes(16).toString('hex'),key=randomBytes(24).toString('hex');
        rooms.set(id,{key,snapshot:null,clients:new Set(),updatedAt:Date.now()});return send(res,201,{id,key});
      }
      const match=/^\/api\/rooms\/([a-f0-9]{32})(?:\/(events))?$/.exec(url.pathname);
      const room=match&&rooms.get(match[1]);if(!room)return send(res,404,{error:'Session unavailable. Reopen the display from the host.'});
      if(req.method==='GET'&&match[2]==='events'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
        res.write('data: '+JSON.stringify(room.snapshot)+'\n\n');room.clients.add(res);
        const timer=setInterval(()=>res.write(': keepalive\n\n'),15000);req.on('close',()=>{clearInterval(timer);room.clients.delete(res);});return;
      }
      if(req.method==='GET')return send(res,200,room.snapshot);
      if(req.method==='POST'){
        const a=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,'')),b=Buffer.from(room.key);
        if(a.length!==b.length||!timingSafeEqual(a,b))return send(res,403,{error:'Host authorization required.'});
        let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>100000)return send(res,413,{error:'Snapshot too large.'});chunks.push(chunk);}
        const value=JSON.parse(Buffer.concat(chunks).toString());
        if(!value||typeof value!=='object'||!['sort','runnerup'].includes(value.challenge)||!Array.isArray(value.cases)||value.cases.length>50)return send(res,400,{error:'Invalid snapshot.'});
        room.snapshot=value;room.updatedAt=Date.now();for(const client of room.clients)client.write('data: '+JSON.stringify(value)+'\n\n');return send(res,200,{ok:true});
      }
      return send(res,405,{error:'Method unavailable.'});
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    const path=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname),file=resolve(root,'.'+path);
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    if(!(await stat(file)).isFile())throw new Error('Missing');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{if(url.pathname.startsWith('/api/'))return send(res,400,{error:'Request could not be processed.'});res.writeHead(404);res.end('Not found');}
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const port=Number(process.env.PORT)||8782;createAppServer().listen(port,'127.0.0.1',()=>console.log('CrowdCase: http://127.0.0.1:'+port));}
