var player_initial_base = ()=>({
   v:1//version
   /*Playing*/
   ,t:Date.now()//last frame update at
   ,g:Date.now()//game since
   /*Options*/
   ,ui:33//update interval/ms
   ,si:10000//autosave interval/ms
   ,D:6//Decimal precision
   ,p:1//Progress statement amount
   ,h:{}//hotkey
   /*Automation*/
   ,a:[]
   /*Achievements (not implemented)*/
   /*Challenges*/
   ,cd:[1,1]//difficulty selection for SCARCITY_TRIAL=0 and TAX_TRIAL=1
   ,cq:[0,0,0,0]//Queueing challenges
   ,c:[['',0],['',0],['',0],['',0]]//running [trigger_layer_id,difficulty] of challenge 0~3
   ,C:[{},{},{},{}]//completions of challenge 0~3
   /*Layers*/
   ,L:{}
})