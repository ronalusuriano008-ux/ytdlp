export function setSession(username){
  console.log("💾 setSession() guardando:", username);
  console.log("🌐 origin actual:", location.origin);

  localStorage.setItem("gmcn_session", username);

  console.log("✅ session guardada:", localStorage.getItem("gmcn_session"));
}

export function getSession(){
  const value = localStorage.getItem("gmcn_session");

  console.log("📦 getSession() leyendo session");
  console.log("🌐 origin actual:", location.origin);
  console.log("📄 gmcn_session:", value);

  return value;
}

export function clearSession(){
  console.log("🗑️ clearSession() eliminando session");
  console.log("🌐 origin actual:", location.origin);

  localStorage.removeItem("gmcn_session");
}