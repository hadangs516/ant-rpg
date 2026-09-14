import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.webmanifest':'application/manifest+json','.md':'text/plain; charset=utf-8'};
export const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');const p=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end('파일을 찾을 수 없습니다.');}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(p).pipe(res);}catch{res.writeHead(400);res.end();}}).listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('개미 키우기 RPG http://127.0.0.1:'+(Number(process.env.PORT)||4173)));

