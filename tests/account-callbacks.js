async function runAccountCallbackTests(source, reportFailures = false, changeAccount = true) {
  const passed=[],failures=[];
  for(const name of ['loadRpgContracts','claimRpgReward','buyGear','equipGear','buyUpgrade','openCase','sellItem','removeListing','buyItem','finishRoachWave']) {
    try {
      const a=source.indexOf('async function '+name+'('),match=/\n(?:async )?function /.exec(source.slice(a+1));
      if(a<0||!match)throw new Error('Missing function '+name);
      const text=source.slice(a,a+1+match.index).trim();let resolve;
      const request=new Promise(r=>{resolve=r;});const noop=()=>{};
      const node={textContent:'',value:'ashab',classList:{add:noop,remove:noop},style:{}};
      const inventory=[{id:'sword',name:'item'}],upgrades={original:true};
      const env={currentAuthUserId:'old',currentUser:'old-user',currentInventory:inventory,currentItemPoints:5,currentCoins:100,currentUpgrades:upgrades,
        EDGE_FUNCTION_NAME:'award-coins',rpgContractBusy:false,caseOpeningInProgress:false,caseRouletteBusy:false,
        roachActive:true,roachRewardSent:false,roachGeneration:1,roachAnimationFrame:null,roachCleanTimer:null,roachItems:[],roachSplats:[],
        document:{getElementById:()=>node,querySelector:()=>null},prompt:()=> '10',confirm:()=>true,
        supabaseClient:{functions:{invoke:()=>request}},RPG_GEAR:[{id:'sword',name:'item',price:1}],
        ensureRpgGear:()=>({owned:name==='buyGear'?[]:['sword']}),
        updateUI:noop,renderRpgContracts:noop,getLocalRpgProgress:()=>({}),showGearMessage:noop,
        renderGearCabinet:noop,renderCharStats:noop,renderInventory:noop,renderMarket:noop,alert:noop,
        playRoachAudio:noop,cancelAnimationFrame:noop,setTimeout:()=>1,clearTimeout:noop,
      };
      const run=new Function('env','with(env){return ('+text+');}')(env);
      const args={loadRpgContracts:[],claimRpgReward:['daily','spend500'],buyGear:['sword'],equipGear:['sword'],buyUpgrade:['ashab','hp'],openCase:[250],sellItem:['item'],removeListing:[1],buyItem:[1],finishRoachWave:[]}[name];
      const pending=run(...args);if(changeAccount)env.currentAuthUserId='new';
      resolve({data:{success:true,newCoins:777,newInventory:[],newItemPoints:0,newUpgrades:{replaced:true},progress:{},earned:50,droppedItem:null}});
      await pending;
      const changed=env.currentCoins!==100||env.currentInventory!==inventory||env.currentUpgrades!==upgrades;
      if(changeAccount&&changed)throw new Error(name+' applied an old account response');
      if(!changeAccount&&!changed)throw new Error(name+' failed to apply the current account response');
      passed.push(name);
    }catch(error){if(!reportFailures)throw error;failures.push({name,error:error.message});}
  }
  return{passed:passed.length,tests:passed,failures};
}
