import * as T from 'three';
import {createCarVisual} from './car-visual.mjs';
export function createTrafficVisual(kind='car'){
  if(kind==='car'){const root=createCarVisual();root.userData.kind='car';root.userData.wheelCount=4;return root;}
  const root=new T.Group(),wheels=[],tri=kind==='tricycle';
  const mat=(color,metalness=0)=>new T.MeshStandardMaterial({color,roughness:.65,metalness});
  const paint=mat(tri?'#459f82':'#4aa9df',.25),dark=mat('#172a34'),metal=mat('#b8c8c9',.7),rubber=mat('#101b22'),skin=mat('#d9ab83'),coat=mat(tri?'#536d66':'#34599a'),helmet=mat(tri?'#e66c42':'#ffda51');
  function add(geometry,material,x,y,z,parent=root){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  const box=(x,y,z,w,h,d,m,parent)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  function rod(a,b,r=.05,m=metal){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start),mesh=add(new T.CylinderGeometry(r,r,delta.length(),8),m,...start.clone().add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;}
  function wheel(x,z){const g=new T.Group();g.position.set(x,.3,z);root.add(g);const tire=add(new T.CylinderGeometry(.3,.3,.14,12),rubber,0,0,0,g);tire.rotation.z=Math.PI/2;for(const angle of [0,Math.PI/2]){const spoke=box(0,0,0,.17,.035,.45,metal,g);spoke.rotation.x=angle;}wheels.push(g);}
  wheel(0,.94);if(tri){wheel(-.67,-.73);wheel(.67,-.73);box(0,.53,-.65,1.35,.13,1.2,paint);box(0,.81,-1.22,1.35,.45,.10,paint);for(const x of [-.65,.65])box(x,.81,-.65,.09,.45,1.2,paint);box(0,.77,-.65,.84,.38,.7,mat('#c29756'));}
  else{wheel(0,-.83);box(0,.48,-.2,.55,.28,1.3,paint);box(0,.79,.66,.53,.6,.23,paint);}
  box(0,.91,-.26,.55,.17,.65,dark);rod([0,.36,.94],[0,1.34,.65],.055);rod([-.38,1.35,.65],[.38,1.35,.65],.045,dark);
  const light=new T.MeshStandardMaterial({color:'#fff2ba',emissive:'#ffe7aa',emissiveIntensity:1.8});box(0,1.16,.81,.25,.16,.08,light);
  // A compact seated rider makes the two silhouettes readable while driving past.
  box(0,1.17,-.12,.43,.56,.34,coat);add(new T.SphereGeometry(.20,10,8),skin,0,1.64,.04);add(new T.SphereGeometry(.23,10,8,0,Math.PI*2,0,Math.PI*.62),helmet,0,1.69,.04);box(0,1.66,.22,.30,.11,.06,dark);
  for(const side of [-1,1]){rod([side*.22,1.35,-.04],[side*.32,1.33,.61],.065,coat);rod([side*.17,.94,-.17],[side*.29,.61,.3],.075,dark);box(side*.28,.51,.35,.18,.13,.32,dark);}
  root.userData={kind,wheelCount:tri?3:2,wheels,trail:{visible:false}};return root;
}
