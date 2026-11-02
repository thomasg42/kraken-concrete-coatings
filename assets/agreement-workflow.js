/* A signature always refers to one server-stored proposal hash. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), form=$('agreement'), status=$('formStatus');
  const fields=['name','phone','email','address','startDate','surface','notice','personalRequest'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val=id=>$(id).value.trim();
  const colors=()=>[...form.querySelectorAll('[name="colors"]:checked')].map(x=>x.value);
  let agreement=null,token='',canSign=false,config=null,busy=false,files=[],drawing=false,dirty=false;
  const storage='kraken-review-session-v2',draftKey='kraken-request-draft-v2';
  const canvas=$('pad'),ctx=canvas.getContext('2d');
  $('signaturePanel').before($('acknowledgmentPanel')); // Review the proposal before acknowledging its terms.
  function notice(){ $('noticeEcho').textContent=val('notice')||'the notice window written on this job'; }
  function renderColors(){ for(const [list,empty] of [['orderList','orderEmpty'],['orderListEnd','orderEmptyEnd']]){$(list).replaceChildren(...colors().map(c=>{const li=document.createElement('li');li.textContent=c;return li}));$(empty).hidden=colors().length>0;} }
  function fitCanvas(){const saved=dirty?canvas.toDataURL():null,r=devicePixelRatio||1;canvas.width=(canvas.clientWidth||600)*r;canvas.height=180*r;ctx.lineWidth=2.4*r;ctx.lineCap='round';ctx.strokeStyle='#263023';if(saved){const i=new Image();i.onload=()=>ctx.drawImage(i,0,0,canvas.width,canvas.height);i.src=saved;}}
  function point(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]}
  canvas.addEventListener('pointerdown',e=>{if(agreement?.status!=='customer_review')return;e.preventDefault();drawing=true;dirty=true;canvas.setPointerCapture(e.pointerId);ctx.beginPath();const p=point(e);ctx.moveTo(...p);ctx.lineTo(p[0]+.1,p[1]);ctx.stroke();});
  canvas.addEventListener('pointermove',e=>{if(drawing){ctx.lineTo(...point(e));ctx.stroke();}});
  ['pointerup','pointercancel'].forEach(n=>canvas.addEventListener(n,()=>drawing=false));
  $('clearSign').addEventListener('click',()=>{dirty=false;fitCanvas();});
  $('typedSign').addEventListener('input',()=>{$('typedPreview').textContent=val('typedSign');});
  window.addEventListener('resize',fitCanvas);
  async function api(path,options={}){
    const headers=new Headers(options.headers||{});if(token)headers.set('Authorization','Bearer '+token);
    if(options.body && !(options.body instanceof FormData)){headers.set('Content-Type','application/json');options.body=JSON.stringify(options.body);}
    const r=await fetch('/api'+path,{...options,headers,credentials:'same-origin',cache:'no-store'});
    const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw Error('Agreement review is not connected here yet. Please contact Kraken to arrange your agreement.');}
    if(!r.ok)throw Error(data.error||data.message||'The request could not be saved. Please try again.');return data;
  }
  function saveDraft(){if(agreement)return;try{sessionStorage.setItem(draftKey,JSON.stringify({fields:Object.fromEntries(fields.map(k=>[k,val(k)])),colors:colors()}));}catch{}}
  function renderMedia(){ $('mediaList').replaceChildren();for(const item of files){const fig=document.createElement('figure');fig.className='media-item';const media=document.createElement(item.file.type.startsWith('video/')?'video':'img');media.src=item.url;media.alt=item.file.name;if(media.tagName==='VIDEO'){media.controls=true;media.preload='metadata';media.playsInline=true;}const caption=document.createElement('figcaption');caption.textContent=item.file.name;const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',()=>{URL.revokeObjectURL(item.url);files=files.filter(x=>x!==item);renderMedia();});fig.append(media,caption,remove);$('mediaList').append(fig);} $('mediaNote').textContent=files.length?files.length+' photo or video files ready to send.':'No photos yet. At least one is required.'; }
  function addFiles(list){if(agreement)return;let error='';for(const file of list){if(!/^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|x-m4v))$/i.test(file.type)&&!(/\.(heic|heif|mov|m4v)$/i.test(file.name))){error='Please choose a supported photo or video.';continue;}if(file.size>80*1024*1024){error='Each file must be 80 MB or smaller.';continue;}if(files.reduce((n,x)=>n+x.file.size,0)+file.size>90*1024*1024){error='Combined files must be 90 MB or smaller.';continue;}if(files.length>=8){error='Please choose no more than eight files.';break;}if(!files.some(x=>x.file.name===file.name&&x.file.size===file.size))files.push({file,url:URL.createObjectURL(file)});}renderMedia();if(error)$('mediaNote').textContent=error;}
  $('jobMedia').addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
  ['dragenter','dragover'].forEach(n=>$('drop').addEventListener(n,e=>{e.preventDefault();$('drop').classList.add('over');}));
  $('drop').addEventListener('dragleave',()=>$('drop').classList.remove('over'));
  $('drop').addEventListener('drop',e=>{e.preventDefault();$('drop').classList.remove('over');addFiles(e.dataTransfer.files);});
  $('drop').addEventListener('paste',e=>{if(e.clipboardData.files.length){e.preventDefault();addFiles(e.clipboardData.files);}});
  form.addEventListener('input',()=>{notice();renderColors();saveDraft();});
  const labels={requested:'Waiting for owner review',owner_review:'Waiting for owner review',customer_review:'Ready for your review',owner_countersign:'Waiting for the owner’s signature',customer_signed:'Waiting for the owner’s signature',complete:'Signed by both parties'};
  function render(){
    const reviewing=agreement?.status==='customer_review'&&canSign;
    fields.forEach(id=>$(id).disabled=!!agreement);
    form.querySelectorAll('[name="colors"]').forEach(x=>x.disabled=!!agreement);
    $('jobMedia').disabled=!!agreement;$('drop').setAttribute('aria-disabled',String(!!agreement));
    $('signaturePanel').hidden=!reviewing;$('acknowledgmentPanel').hidden=!reviewing;
    $('signBtn').hidden=!!agreement&&!reviewing;$('signBtn').disabled=busy||!config?.configured;
    $('signBtn').textContent=busy?'Saving…':reviewing?'Sign this approved version':'Send request to owner';
    if(!agreement){$('workflowPanel').hidden=true;return;}
    const a=agreement,r=a.status==='requested'?null:a.revision;
    const p=$('workflowPanel');p.hidden=false;
    p.innerHTML='<span class="workflow-tag">'+esc(labels[a.status]||a.status)+'</span><h3>Your proposal</h3><p class="workflow-version">'+esc(a.id)+'</p>';
    if(r){p.innerHTML+='<dl><dt>Project price</dt><dd>'+money(r.amount)+'</dd><dt>Deposit</dt><dd>'+money(r.deposit)+'</dd><dt>Payments</dt><dd class="terms-copy">'+esc(r.paymentSchedule)+'</dd></dl><h3>Owner-approved arrangements</h3><p class="terms-copy">'+esc(r.terms||'No additional arrangements.')+'</p><p class="workflow-version">Version '+esc(r.version??r.number)+'</p><details open class="version-terms"><summary>Full agreement terms for this version</summary>'+(r.snapshot?.baseTerms||a.baseTerms||[]).map(x=>'<h3>'+esc(x.title)+'</h3><p>'+esc(x.text)+'</p>').join('')+'</details>';
    }else p.innerHTML+='<p>The owner will review your job details and your request, then return the price, payment schedule, and agreed arrangements for you to check.</p>';
    if(a.status==='customer_review'&&!canSign)p.innerHTML+='<p>Open the customer review link from your email to sign this proposal. In this preview, the link is in the owner inbox.</p>';
    if(reviewing)p.innerHTML+='<p>Check the job details, selected finishes, full agreement above, and these terms. If anything needs to change, ask the owner before signing.</p><div class="workflow-actions"><button type="button" id="askChange">Ask for a change</button></div>';
    if(a.status==='owner_countersign'||a.status==='customer_signed')p.innerHTML+='<p>Your signature is recorded on this version. The owner must add their signature before the agreement is complete.</p>';
    if(a.status==='complete')p.innerHTML+='<p>Both signatures are on the same version. Your completed copy includes the job details, photos, full terms, and payment arrangements.</p><div class="workflow-actions"><button type="button" class="primary" id="downloadCopy">Download completed agreement</button></div>';
    if(config.preview)p.innerHTML+='<p class="note">Preview only: notification steps are saved in the owner preview inbox. No emails have been sent.</p>';
    const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh agreement status';refresh.addEventListener('click',refreshAgreement);const actions=document.createElement('div');actions.className='workflow-actions';actions.append(refresh);p.append(actions);
    $('askChange')?.addEventListener('click',showChange);
    $('downloadCopy')?.addEventListener('click',download);
    if(reviewing&&!canvas.width)fitCanvas();
    document.querySelectorAll('.media-item button:not([data-keep])').forEach(x=>x.hidden=!!agreement);
  }
  function money(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));}
  function renderSavedMedia(a){
    $('mediaList').replaceChildren(...(a.media||[]).map(m=>{const fig=document.createElement('figure');fig.className='media-item';const caption=document.createElement('figcaption');caption.textContent=m.name||m.filename||'Job media';const button=document.createElement('button');button.type='button';button.textContent='View saved job file';button.dataset.keep='';fig.append(caption,button);button.addEventListener('click',async()=>{button.disabled=true;try{const response=await fetch('/api/agreements/'+a.id+'/media/'+m.id,{headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('Unable to load this job file.');const blob=await response.blob(),media=document.createElement(blob.type.startsWith('video/')?'video':'img');media.src=URL.createObjectURL(blob);media.alt=m.filename||'Job photo';if(media.tagName==='VIDEO'){media.controls=true;media.playsInline=true;}fig.prepend(media);button.remove();}catch(error){caption.textContent=error.message;button.disabled=false;}});return fig;}));
  }
  function populate(a){const changed=agreement?.revision?.hash!==a.revision?.hash||agreement?.status!==a.status;agreement=a;const snapshot=a.status==='requested'?null:a.revision?.snapshot;if(snapshot){a={...a,customer:snapshot.customer,job:snapshot.job,requestText:snapshot.requestText};for(const clause of snapshot.acknowledgments||[]){const input=form.querySelector('[data-clause="'+clause.key+'"]');if(input)input.parentElement.querySelector("span").textContent=clause.text;}}for(const k of ['name','phone','email','address'])$(k).value=a.customer[k]||'';for(const k of ['startDate','surface','notice'])$(k).value=a.job[k]||'';$('personalRequest').value=a.requestText||'';form.querySelectorAll('[name="colors"]').forEach(x=>x.checked=(a.job.colors||[]).includes(x.value));notice();renderColors();if(!files.length){$('mediaNote').textContent=(a.media||[]).length+' job files securely stored with this request.';renderSavedMedia(a);}render();if(changed){$('typedSign').value='';$('typedPreview').textContent='';$('signConsent').checked=false;dirty=false;form.querySelectorAll('[data-clause]').forEach(x=>x.checked=false);fitCanvas();}}
  async function refreshAgreement(){try{status.textContent='Checking the saved agreement…';const d=await api('/agreements/'+encodeURIComponent(agreement.id));populate(d.agreement);status.textContent='Agreement status updated.';}catch(e){status.textContent=e.message;}}
  function showChange(){const p=$('workflowPanel'),box=document.createElement('div');box.className='request-note';box.innerHTML='<label class="field">What should the owner change?<textarea id="changeText" rows="4" maxlength="6000"></textarea></label><div class="workflow-actions"><button type="button" class="primary" id="sendChange">Send change request</button></div>';$('askChange').disabled=true;p.append(box);$('changeText').focus();$('sendChange').addEventListener('click',async()=>{if(!val('changeText'))return;$('sendChange').disabled=true;try{const d=await api('/agreements/'+agreement.id+'/change-request',{method:'POST',body:{requestText:val('changeText')}});populate(d.agreement);status.textContent='Your change request is saved for the owner to review.';}catch(e){status.textContent=e.message;$('sendChange').disabled=false;}});}
  async function download(){try{const r=await fetch('/api/agreements/'+agreement.id+'/artifact',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('The completed copy could not be downloaded.');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=agreement.id+'-completed.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status.textContent=e.message;}}
  function gaps(){const g=[];for(const [id,label]of [['name','name'],['phone','phone number'],['email','email'],['address','property address'],['startDate','scheduled start'],['notice','warranty notice window']])if(!val(id))g.push('Add your '+label+'.');if(val('email')&&!$('email').checkValidity())g.push('Use a valid email address.');if(!colors().length)g.push('Choose at least one finish.');if(!files.length)g.push('Add at least one photo or video of the job area.');return g;}
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!config?.configured)return;
    const reviewing=agreement?.status==='customer_review'&&canSign;
    if(agreement&&!reviewing)return;
    if(!reviewing){const missing=gaps();if(missing.length){status.textContent=missing.join(' ');return;}}
    else{if([...form.querySelectorAll('[data-clause]')].some(x=>!x.checked)||!$('signConsent').checked){status.textContent='Review and check every agreement line and the electronic signature consent.';return;}if(!dirty&&val('typedSign').length<2){status.textContent='Draw your signature or type your full name.';return;}}
    busy=true;render();status.textContent=reviewing?'Recording your signature…':'Saving your request and job photos…';
    try{
      let d;if(reviewing){d=await api('/agreements/'+agreement.id+'/customer-sign',{method:'POST',body:{revisionHash:agreement.revision.hash,name:val('typedSign')||val('name'),consent:true,signatureData:dirty?canvas.toDataURL('image/png'):undefined,acknowledgments:[...form.querySelectorAll('[data-clause]')].map(x=>x.dataset.clause)}});}
      else{const data={customer:Object.fromEntries(['name','email','phone','address'].map(k=>[k,val(k)])),job:{...Object.fromEntries(['startDate','surface','notice'].map(k=>[k,val(k)])),colors:colors()},requestText:val('personalRequest')};const body=new FormData();body.append('data',JSON.stringify(data));files.forEach(x=>body.append('media',x.file,x.file.name));d=await api('/requests',{method:'POST',body});token=d.customerToken;try{sessionStorage.setItem(storage,JSON.stringify({id:d.agreement.id,token,canSign:false}));sessionStorage.removeItem(draftKey);}catch{}}
      populate(d.agreement);status.textContent=reviewing?'Your signature is saved. The owner signs next.':'Your request is saved. The owner reviews the arrangements before you sign.';
      if(config.preview)status.textContent+=' Local preview only; no email was sent.';
      $('workflowPanel').scrollIntoView({behavior:'auto',block:'center'});
    }catch(err){status.textContent=err.message;}finally{busy=false;render();}
  });
  async function init(){
    const params=new URLSearchParams(location.search);let draft=null;try{draft=JSON.parse(sessionStorage.getItem(draftKey)||'null')}catch{}
    if(draft&&!params.size){for(const k of fields)$(k).value=draft.fields[k]||'';form.querySelectorAll('[name="colors"]').forEach(x=>x.checked=(draft.colors||[]).includes(x.value));}
    for(const k of ['name','phone','email','address','notice','surface'])if(params.has(k))$(k).value=params.get(k);if(params.has('date'))$('startDate').value=params.get('date');
    if(params.has('color')){const wanted=params.get('color').split(',').map(x=>x.trim().toLowerCase());form.querySelectorAll('[name="colors"]').forEach(x=>x.checked=wanted.some(w=>w&&x.value.toLowerCase().includes(w)));}
    notice();renderColors();render();
    try{
      config=await api('/config');$('previewTools').hidden=!config.preview;
      const hash=location.hash.slice(1);let session=null;if(/^(review|copy)=/.test(hash)){const parts=hash.slice(hash.indexOf('=')+1).split('&');session={canSign:hash.startsWith('review='),id:decodeURIComponent(parts[0]),token:decodeURIComponent((parts[1]||'').replace(/^token=/,''))};history.replaceState(null,'',location.pathname+'#sign');try{sessionStorage.setItem(storage,JSON.stringify(session))}catch{}}
      else try{session=JSON.parse(sessionStorage.getItem(storage)||'null')}catch{}
      if(session?.id&&session.token){token=session.token;canSign=!!session.canSign;const d=await api('/agreements/'+encodeURIComponent(session.id));populate(d.agreement);}
      render();
    }catch(e){status.textContent=e.message;$('signBtn').disabled=true;}
  }
  window.addEventListener('hashchange',()=>{if(/^#(review|copy)=/.test(location.hash))init();});
  init();
})();
