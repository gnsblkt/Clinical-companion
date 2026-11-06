export type AIProvider = "auto"|"openai"|"groq"|"openrouter"|"gemini"|"anthropic"|"deepseek"|"mistral"|"deepinfra"|"custom";
export type AIMessage={role:"system"|"user"|"assistant";content:string};
export const PROVIDER_STORAGE_KEY="clinical-ai-provider";
export const BASE_URL_STORAGE_KEY="clinical-ai-base-url";
export const FALLBACK_MODELS:Record<Exclude<AIProvider,"auto">,string[]> = {
 openai:["gpt-4.1","gpt-4.1-mini","gpt-4.1-nano","gpt-4o","gpt-4o-mini","o3","o3-mini","o4-mini"],
 groq:["llama-3.3-70b-versatile","llama-3.1-8b-instant","openai/gpt-oss-120b","openai/gpt-oss-20b","qwen/qwen3-32b"],
 openrouter:["openai/gpt-4.1","openai/gpt-4o-mini","anthropic/claude-sonnet-4","google/gemini-2.5-flash","deepseek/deepseek-chat","meta-llama/llama-3.3-70b-instruct"],
 gemini:["gemini-2.5-pro","gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.0-flash"],
 anthropic:["claude-sonnet-4-5","claude-sonnet-4","claude-haiku-4-5","claude-opus-4-1"],
 deepseek:["deepseek-chat","deepseek-reasoner"],
 mistral:["mistral-large-latest","mistral-small-latest","codestral-latest"],
 deepinfra:["deepseek-ai/DeepSeek-V4-Flash-0731","meta-llama/Meta-Llama-3.3-70B-Instruct","Qwen/Qwen3-Next-80B-A3B-Instruct","mistralai/Mistral-Small-3.1-24B-Instruct-2503","deepseek-ai/DeepSeek-R1"],
 custom:["gpt-4o-mini"]
};
export function fallbackModels(provider:AIProvider,key=""):string[]{const p=provider==="auto"?detectProvider(key):provider;return p==="auto"?[]:FALLBACK_MODELS[p];}
export function detectProvider(key:string):AIProvider{
 const k=key.trim(); if(k.startsWith("gsk_"))return "groq";if(k.startsWith("sk-or-"))return "openrouter";if(k.startsWith("AIza"))return "gemini";if(k.startsWith("sk-ant-"))return "anthropic";if(k.startsWith("sk-"))return "openai";return "openai";
}
export function currentProvider():AIProvider{const p=(localStorage.getItem(PROVIDER_STORAGE_KEY)||"auto") as AIProvider;return p==="auto"?detectProvider(localStorage.getItem("clinical-ai-key")||""):p;}
export function providerBase(p:AIProvider):string{
 if(p==="custom")return (localStorage.getItem(BASE_URL_STORAGE_KEY)||"").trim().replace(/\/$/,"");
 if(p==="openai")return "https://api.openai.com/v1";if(p==="groq")return "https://api.groq.com/openai/v1";if(p==="openrouter")return "https://openrouter.ai/api/v1";if(p==="deepseek")return "https://api.deepseek.com/v1";if(p==="mistral")return "https://api.mistral.ai/v1";if(p==="deepinfra")return "https://api.deepinfra.com/v1/openai";return "";
}
export async function chatCompletion(provider:AIProvider,key:string,model:string,messages:AIMessage[],temperature=0.3,maxTokens=1200):Promise<string>{
 const p=provider==="auto"?detectProvider(key):provider;
 if(p==="gemini"){
  const system=messages.find(m=>m.role==="system")?.content||"";
  const contents=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:system?{parts:[{text:system}]}:undefined,contents,generationConfig:{temperature,maxOutputTokens:maxTokens}})});
  const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Gemini request failed ("+r.status+")");const s=(d?.candidates?.[0]?.content?.parts||[]).map((x:any)=>x.text||"").join("").trim();if(!s)throw new Error("Gemini returned no text");return s;
 }
 if(p==="anthropic"){
  const system=messages.find(m=>m.role==="system")?.content||"";const msgs=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}));
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model,system,messages:msgs,max_tokens:maxTokens,temperature})});
  const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Claude request failed ("+r.status+")");const s=(d?.content||[]).filter((x:any)=>x.type==="text").map((x:any)=>x.text||"").join("").trim();if(!s)throw new Error("Claude returned no text");return s;
 }
 const base=providerBase(p);if(!base)throw new Error("Set custom API base URL in settings");
 const r=await fetch(base+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key,...(p==="openrouter"?{"HTTP-Referer":location.origin,"X-Title":"Clinical Companion"}:{})},body:JSON.stringify({model,messages,temperature,max_tokens:maxTokens})});
 const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"API request failed ("+r.status+")");const s=d?.choices?.[0]?.message?.content;if(typeof s==="string"&&s.trim())return s.trim();if(Array.isArray(s)){const t=s.map((x:any)=>x.text||"").join("").trim();if(t)return t;}throw new Error("Provider returned an empty response");
}
export async function listProviderModels(provider:AIProvider,key:string):Promise<string[]>{
 const p=provider==="auto"?detectProvider(key):provider;
 if(p==="gemini"){const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?key="+encodeURIComponent(key));const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Model list failed");return(d.models||[]).filter((m:any)=>m.supportedGenerationMethods?.includes("generateContent")).map((m:any)=>String(m.name||"").replace(/^models\//,""));}
 if(p==="anthropic"){const r=await fetch("https://api.anthropic.com/v1/models",{headers:{"x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Model list failed");return(d.data||[]).map((m:any)=>m.id).filter(Boolean);}
 const base=providerBase(p);if(!base)throw new Error("Set custom API base URL first");const r=await fetch(base+"/models",{headers:{"Authorization":"Bearer "+key,...(p==="openrouter"?{"HTTP-Referer":location.origin,"X-Title":"Clinical Companion"}:{})}});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Model list failed");return(d.data||[]).map((m:any)=>m.id).filter(Boolean).sort();
}