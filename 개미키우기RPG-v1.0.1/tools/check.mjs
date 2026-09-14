import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
let failed=false;
for(const file of fs.readdirSync('src').filter(x=>x.endsWith('.js'))){
  const result=spawnSync(process.execPath,['--check','src/'+file],{encoding:'utf8'});
  if(result.error||result.status!==0){failed=true;console.error(file+': '+(result.error?.message||result.stderr));}
}
for(const file of ['index.html','styles.css','assets/favicon.svg','assets/favicon.ico','assets/kakao-preview.png','assets/share-preview.png','apps-script/Code.gs']){
  if(!fs.existsSync(file)){failed=true;console.error('누락: '+file);}
}
console.log(failed?'검증 실패':'소스 문법 및 필수 파일 검증 완료');
process.exitCode=failed?1:0;
