import test from 'node:test';
import assert from 'node:assert/strict';
import {TEAM_POSTS,cameraForTeam,projectTeam,unprojectTeam,teamWorkerPose,hitTeamWorker} from './team-renderer.mjs';

test('team camera and pointers use one invertible coordinate space at wide and phone scales',()=>{
 for(const [width,height]of[[900,640],[390,460],[1440,900]])for(const focus of[null,'evidence','reviewer']){
  const camera=cameraForTeam(width,height,{focus,zoom:1.2,pan:{x:17,y:-9}});
  assert(camera.scale>0);
  for(const post of TEAM_POSTS){const restored=unprojectTeam(projectTeam(post,camera),camera);assert(Math.abs(restored.x-post.x)<1e-9);assert(Math.abs(restored.y-post.y)<1e-9);}
 }
});

test('sender returns home, recipient reacts, and reversing progress restores exact poses',()=>{
 const interaction={from:'evidence',to:'analyst',artifactKind:'source'};
 const home=teamWorkerPose('evidence');
 assert.deepEqual(teamWorkerPose('evidence',{...interaction,progress:1}),home);
 const mid=teamWorkerPose('evidence',{...interaction,progress:.3});assert.notEqual(mid.x,home.x);assert.equal(mid.act,'walk');assert.equal(mid.carrying,true);
 assert.equal(teamWorkerPose('analyst',{...interaction,progress:.51}).act,'receive');
 assert.equal(teamWorkerPose('analyst',{...interaction,progress:.8}).carrying,true);
 assert.deepEqual(teamWorkerPose('evidence',{...interaction,progress:.3}),mid);
 assert.equal(hitTeamWorker({x:mid.x,y:mid.y-35},{...interaction,progress:.3}),'evidence');
});

test('all real role pairs have finite continuous paths and no arbitrary idle walking',()=>{
 for(const from of TEAM_POSTS)for(const to of TEAM_POSTS){
  const base=teamWorkerPose(from.id);assert.equal(base.walk,0);assert.deepEqual(base,teamWorkerPose(from.id,null));
  if(from===to)continue;
  for(let i=1;i<200;i++){const p=i/200,a=teamWorkerPose(from.id,{from:from.id,to:to.id,progress:p}),b=teamWorkerPose(from.id,{from:from.id,to:to.id,progress:p+.0001});assert(Number.isFinite(a.x)&&Number.isFinite(a.y));assert(Math.hypot(a.x-b.x,a.y-b.y)<1.5,`${from.id}→${to.id} jumped at ${p}`);}
 }
});
