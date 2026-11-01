import assert from 'node:assert/strict';
import { isBlockedRequestSource } from '../netlify/lib/request-source-policy.mjs';
import handler from '../netlify/functions/upload.mjs';

const blocked = ['https://yetland.cn','http://yetland.cn:8080','https://www.yetland.cn/path?q=1','https://a.b.yetland.cn','https://YETLAND.CN','https://yetland.cn.','https://sub.yetland.cn.'];
const allowed = [null,'','null','not a URL','https://notyetland.cn','https://yetland.cn.example.org','https://example.org/yetland.cn','https://yetland.cn@example.org','https://floatbubble.netlify.app','https://other-self-host.example','https://example.org/?next=https://yetland.cn','ftp://yetland.cn'];
let count = 0;
for (const header of ['origin','referer']) {
  for (const value of blocked) { assert.equal(isBlockedRequestSource(new Headers({[header]:value})),true,value); count++; }
  for (const value of allowed) { assert.equal(isBlockedRequestSource(new Headers(value == null ? {} : {[header]:value})),false,String(value)); count++; }
}
assert.equal(isBlockedRequestSource(new Headers({origin:'https://example.org',referer:'https://yetland.cn/a'})),true); count++;
assert.equal(isBlockedRequestSource(new Headers({origin:'https://yetland.cn',referer:'https://example.org'})),true); count++;
let fetches = 0, parsed = 0, ipReads = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { fetches++; throw new Error('No real network permitted in tests'); };
try {
  for (const method of ['OPTIONS','POST','GET']) {
    for (const action of ['upload','flower','head','edit','delete','claim','contribute','unknown']) {
      for (const header of ['origin','referer']) {
        const req = {method,headers:new Headers({[header]:'https://app.yetland.cn'}),json:async()=>{parsed++; return {action};}};
        const response = await handler(req, {get ip(){ipReads++;return 'test';}});
        assert.equal(response.status,403); assert.equal(response.headers.get('access-control-allow-origin'),null);
        assert.equal(response.headers.get('cache-control'),'no-store'); assert.equal((await response.json()).ok,false); count++;
      }
    }
  }
  for (const origin of [null,'https://floatbubble.netlify.app','https://notyetland.cn','https://another-self-host.example']) {
    const response=await handler(new Request('https://local.test',{method:'OPTIONS',headers:origin?{origin}:{}}),{});
    assert.equal(response.status,204); assert.equal(response.headers.get('access-control-allow-origin'),'*'); count++;
  }
  const methodResponse=await handler(new Request('https://local.test',{method:'GET'}),{});
  assert.equal(methodResponse.status,405); count++;
  assert.equal(fetches,0); assert.equal(parsed,0); assert.equal(ipReads,0); count+=3;
} finally {globalThis.fetch=originalFetch;}
console.log(`${count} checks passed; no network, business writes, body parsing or context/IP access for blocked requests.`);
