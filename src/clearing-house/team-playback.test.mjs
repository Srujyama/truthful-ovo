import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamPlayback,teamPlaybackPose} from './team-playback.mjs';

test('pause, hidden time and reverse preserve the exact handoff pose',()=>{
 const clock=createTeamPlayback({length:3,duration:1000});clock.play();clock.tick(100);clock.tick(175);
 assert.equal(clock.read().progress,.075);clock.pause();clock.tick(1000);assert.equal(clock.read().time,75);
 clock.play();clock.tick(2000);clock.tick(2075,false);clock.tick(9000);assert.equal(clock.read().time,75);
 clock.tick(9050);assert.equal(clock.read().time,125);clock.suspend();clock.tick(30000);assert.equal(clock.read().time,125,'visibility suspension excludes an entire hidden interval without a catch-up frame');clock.play(-1);clock.tick(9100);clock.tick(9150);
 assert.equal(clock.read().time,75);assert.equal(clock.read().progress,.075);
});
test('seek and restart expose exact endpoints without simulating financial writes',()=>{
 const clock=createTeamPlayback({length:2,duration:1000});clock.seek(2000);assert.equal(clock.read().finished,true);assert.equal(clock.read().progress,1);assert.equal(clock.read().completed,2);
 clock.play();assert.equal(clock.read().time,0);clock.play(-1);assert.equal(clock.read().time,0,'reverse at the first pose must not teleport to the last handoff');assert.equal(clock.read().playing,false);clock.seek(1250);assert.deepEqual(teamPlaybackPose(clock.read().time,2,1000),{index:1,progress:.25,completed:1});
 clock.configure({length:1});assert.equal(clock.read().time,1000);clock.reset(0);assert.equal(clock.read().playing,false);assert.equal(clock.read().completed,0);
});
