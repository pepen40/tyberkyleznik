async function runInvitationPreferenceTest(source) {
  const normalized=source.replace(/\r/g,'');
  const start=normalized.indexOf('window.syncServerInviteSettings = async');
  const end=normalized.indexOf("\n    rpgToggle.checked =\n        localStorage.getItem",start);
  if(start<0||end<0)throw new Error('Settings boundary missing');
  const expression=normalized.slice(start,end).trim().replace(/^window.syncServerInviteSettings = /,'').replace(/;$/,'');
  const storage=new Map([['rpgInvitesEnabled','false'],['chessInvitesEnabled','true']]),calls=[];
  const env={currentAuthUserId:'account',EDGE_FUNCTION_NAME:'award-coins',serverInviteSettings:null,rpgToggle:{checked:false},chessToggle:{checked:true},window:{},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},document:{getElementById:()=>({})},
    supabaseClient:{functions:{invoke:async(_name,{body})=>{
      calls.push(body);
      return {data:body.data.value ? {success:true,configured:true,...JSON.parse(body.data.value)} : {success:true,configured:false,rpg:true,chess:true}};
    }}}};
  env.window.syncServerInviteSettings=new Function('env','with(env){return ('+expression+');}')(env);
  await env.window.syncServerInviteSettings();
  if(env.rpgToggle.checked!==false||storage.get('rpgInvitesEnabled')!=='false'||calls.length!==2)throw new Error('Existing browser invitation block was reset instead of migrated');
  return {passed:1,tests:['first server preference synchronization preserves an existing browser block']};
}
