#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { verifyAuthorityPacket } from '../src/authority/index.mjs';
const args=process.argv.slice(2),trustIndex=args.indexOf('--trust');
if(!args[0]||trustIndex<0||!args[trustIndex+1]||args.length!==3){console.error('Usage: node scripts/verify-authority.mjs packet.json --trust independently-pinned-issuers.json\nTrust file must be an out-of-band array of {issuer,keyId,publicKey}; the packet never supplies its own trust root.');process.exit(2);}
try{const packet=JSON.parse(await readFile(args[0],'utf8')),trustedIssuers=JSON.parse(await readFile(args[trustIndex+1],'utf8'));const result=await verifyAuthorityPacket(packet,{trustedIssuers});console.log(JSON.stringify(result,null,2));process.exitCode=result.valid?0:1;}catch(error){console.error(error.message);process.exitCode=1;}
