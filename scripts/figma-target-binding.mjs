const MARKER_PREFIX='truthful-ovo-design-v1:';
const ATTESTATION_METHOD='native-file-url-and-plugin-context';
const MAX_AGE_MS=30*60*1000;
const MAX_FUTURE_MS=60*1000;
const UI_TRUST_NOTICE='Trusted operator UI attestation, not cryptographic proof of file identity. The operator verified the target URL and the connected native document/page together.';

function targetKey(fileUrl,label='Target file URL'){
 if(typeof fileUrl!=='string')throw new Error(`${label} must be an HTTPS Figma Design URL.`);
 let url;
 try{url=new URL(fileUrl);}catch{throw new Error(`${label} must be an HTTPS Figma Design URL.`);}
 if(url.protocol!=='https:'||!['figma.com','www.figma.com'].includes(url.hostname)||url.username||url.password||url.port)throw new Error(`${label} must be an HTTPS Figma Design URL.`);
 const match=url.pathname.match(/^\/design\/([A-Za-z0-9]+)(?:\/|$)/);
 if(!match)throw new Error(`${label} must identify a Figma Design file.`);
 return match[1];
}
function timestamp(value){
 if(value instanceof Date)return value.getTime();
 if(typeof value==='number')return Number.isFinite(value)?value:NaN;
 return typeof value==='string'&&value.trim()?Date.parse(value):NaN;
}
function contextId(value,label){
 if(typeof value!=='string'||!value.trim())throw new Error(`${label} is required to bind the operator attestation to the connected plugin context.`);
 return value;
}

/** Validate identity before the importer writes a persistent kit marker.
 *
 * Native file keys are checked whenever available, even on resume. A correct
 * marker resumes an already bound kit; it does not authenticate an arbitrary
 * document. When the private file-key API is unavailable on a first import,
 * the caller must supply an independently prepared, recent operator attestation.
 * This helper never creates an attestation, reads a credential, or changes Figma.
 */
export function validateTargetBinding(initial,{fileUrl,attestation,now}={}){
 if(!initial||typeof initial!=='object'||Array.isArray(initial))throw new Error('A connected native document snapshot is required.');
 const fileKey=targetKey(fileUrl),expectedMarker=MARKER_PREFIX+fileKey;
 const marker=initial.marker;
 if(marker!=null&&marker!==''&&marker!==expectedMarker)throw new Error('The connected document has a different design-kit marker.');
 const nativeKey=initial.fileKey;
 if(nativeKey!=null){
  if(typeof nativeKey!=='string'||!nativeKey||nativeKey!==fileKey)throw new Error('The connected native file key differs from the target file URL.');
  return {method:'native-file-key',evidence:{fileUrl,fileKey,nativeFileKey:nativeKey,marker:marker||null,documentId:initial.documentId||null,currentPageId:initial.currentPageId||null,notice:'The native file-key API matched the supplied target URL.'}};
 }
 if(marker===expectedMarker){
  return {method:'persistent-kit-marker',evidence:{fileUrl,fileKey,marker,documentId:initial.documentId||null,currentPageId:initial.currentPageId||null,notice:'Resumed an already bound kit using its persistent marker. The private native file-key API is unavailable; the marker is not independent cryptographic proof of file identity.'}};
 }
 if(!attestation||typeof attestation!=='object'||Array.isArray(attestation))throw new Error('Native file key unavailable: first import requires a separately supplied operator UI attestation. An empty document alone does not establish target identity.');
 if(attestation.operatorVerified!==true||attestation.method!==ATTESTATION_METHOD)throw new Error('A verified native-file-url-and-plugin-context operator attestation is required.');
 if(targetKey(attestation.fileUrl,'Attested file URL')!==fileKey)throw new Error('The operator attestation identifies a different target file URL.');
 const documentId=contextId(initial.documentId,'Connected document ID');
 const currentPageId=contextId(initial.currentPageId,'Connected current page ID');
 if(attestation.documentId!==documentId||attestation.currentPageId!==currentPageId)throw new Error('The operator attestation does not match the connected native document/page context.');
 const currentTime=timestamp(now);
 if(!Number.isFinite(currentTime))throw new Error('An explicit valid current time is required to validate the operator attestation.');
 if(typeof attestation.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(attestation.observedAt))throw new Error('The operator attestation requires a valid observedAt timestamp with timezone.');
 const observedTime=Date.parse(attestation.observedAt);
 if(!Number.isFinite(observedTime))throw new Error('The operator attestation has an invalid observedAt timestamp.');
 const ageMs=currentTime-observedTime;
 if(ageMs>MAX_AGE_MS)throw new Error('The operator attestation is stale; verify the native URL and plugin context again within 30 minutes.');
 if(ageMs < -MAX_FUTURE_MS)throw new Error('The operator attestation is more than one minute in the future.');
 return {method:'operator-ui-attestation',evidence:{fileUrl,fileKey,documentId,currentPageId,observedAt:new Date(observedTime).toISOString(),validatedAt:new Date(currentTime).toISOString(),ageMs,operatorVerified:true,attestationMethod:ATTESTATION_METHOD,notice:UI_TRUST_NOTICE}};
}
