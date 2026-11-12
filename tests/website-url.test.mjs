import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMUNITY_URL,resolveWebsiteUrl,communityWebsiteLink} from '../src/website-url.mjs';

test('Website follows the Altare domain even with the old host ENV or a saved support link',()=>{
 assert.equal(resolveWebsiteUrl('https://duckzincommunity.vercel.app'),COMMUNITY_URL);
 assert.equal(resolveWebsiteUrl('https://duckzincommunity.vercel.app/#suporte'),COMMUNITY_URL+'/#suporte');
 assert.equal(communityWebsiteLink('https://duckzincommunity.vercel.app/projects?q=duck#download'),COMMUNITY_URL+'/projects?q=duck#download');
 assert.equal(resolveWebsiteUrl('not a URL'),COMMUNITY_URL);
 assert.equal(resolveWebsiteUrl('http://example.net'),COMMUNITY_URL);
 assert.equal(resolveWebsiteUrl('https://example.net/custom'),'https://example.net/custom');
 for(const url of ['https://evil.example','https://duckcommunity.go.altare.global.evil.example','https://duckcommunity.go.altare.global@evil.example','https://user:password@duckcommunity.go.altare.global','https://duckcommunity.go.altare.global:444/'])assert.equal(communityWebsiteLink(url),null,url);
 assert.equal(communityWebsiteLink(COMMUNITY_URL+'/#suporte'),COMMUNITY_URL+'/#suporte');
});
