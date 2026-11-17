const KEY="bulk-coach-state-v1", CFG=window.BULK_CONFIG||{};
const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
const fmt=x=>Math.round(x).toLocaleString();
const defaultData=()=>({
  version:1,updatedAt:Date.now(),startDate:today(),goal:79,calories:3300,protein:160,
  workouts:[
    ["Upper A","Monday"],["Lower A","Tuesday"],["Upper B","Thursday"],["Lower B","Friday"]
  ],
  exercises:[
    ["Upper A","Bench press",3,6,10,2.5],["Upper A","Lat pulldown",3,8,12,2.5],["Upper A","Incline dumbbell press",3,8,12,2],["Upper A","Seated cable row",3,8,12,2.5],["Upper A","Lateral raise",3,12,15,1],["Upper A","Triceps pushdown",2,10,15,2.5],["Upper A","Biceps curl",2,10,15,1],
    ["Lower A","Squat / hack squat",3,6,10,2.5],["Lower A","Romanian deadlift",3,8,10,2.5],["Lower A","Leg press",3,10,12,5],["Lower A","Leg curl",3,10,15,2.5],["Lower A","Calf raise",3,12,15,2.5],
    ["Upper B","Shoulder press",3,6,10,2],["Upper B","Pull-up / pulldown",3,8,12,2.5],["Upper B","Chest press machine",3,8,12,2.5],["Upper B","Chest supported row",3,8,12,2.5],["Upper B","Lateral raise",3,12,20,1],["Upper B","Biceps curl",3,10,15,1],["Upper B","Overhead triceps extension",3,10,15,1],
    ["Lower B","Hack squat / front squat",3,8,12,2.5],["Lower B","Hip thrust",3,8,12,5],["Lower B","Leg extension",3,10,15,2.5],["Lower B","Seated leg curl",3,10,15,2.5],["Lower B","Calf raise",3,12,15,2.5],["Lower B","Ab crunch machine",3,10,15,2.5]
  ].map(([day,name,sets,lo,hi,step])=>({id:uid(),day,name,sets,lo,hi,step})),
  foods:[
    ["Egg, large",72,6,0.5,5,"1 egg"],["Cooked chicken breast",165,31,0,3.6,"100 g"],["Cooked white rice",130,2.7,28,0.3,"100 g"],["Oats dry",389,17,66,7,"100 g"],["Whole milk",62,3.2,4.8,3.3,"100 ml"],["Banana",105,1.3,27,0.4,"1 medium"],["Plain Greek yogurt",100,17,6,0,"170 g"],["Olive oil",120,0,0,14,"1 tbsp"],["Lean beef cooked",210,28,0,10,"100 g"],["Potatoes cooked",87,1.9,20,0.1,"100 g"],["Whole wheat bread",95,4,17,1.2,"1 slice"],["Peanut butter",95,3.5,3.5,8,"1 tbsp"]
  ].map(([name,kcal,p,c,f,portion])=>({id:uid(),name,kcal,p,c,f,portion})),
  reminders:[
    ["Breakfast","08:00","every"],["Lunch","12:00","every"],["Gym","14:30","training"],["Dinner","18:30","every"],["Daily review","21:30","every"]
  ].map(([name,time,days])=>({id:uid(),name,time,days,enabled:true})),
  entries:[],meals:[],weights:[],measurements:[],fields:[],fieldLogs:[],checks:{}
});
let state;try{state=JSON.parse(localStorage.getItem(KEY))||defaultData()}catch{state=defaultData()}
for(const [k,v] of Object.entries(defaultData()))if(state[k]===undefined)state[k]=v;
let tab="today",activeWorkout=state.workouts[0]?.[0]||"Upper A",editing=null,syncState="Local backup active",pushState="Not enabled",writeTimer,remoteReady=false;
const store=()=>{state.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(state));render();scheduleSync()};
const getDailyMeals=(d=today())=>state.meals.filter(m=>m.date===d);
const nutrient=(d=today())=>getDailyMeals(d).reduce((a,m)=>{const f=state.foods.find(x=>x.id===m.foodId);if(f)for(const k of ["kcal","p","c","f"])a[k]+=number(f[k])*number(m.servings,1);return a},{kcal:0,p:0,c:0,f:0});
const workoutFor=()=>{const day=new Date().toLocaleDateString("en-US",{weekday:"long"});return state.workouts.find(x=>x[1]===day)?.[0]};
const latestWeight=()=>[...state.weights].sort((a,b)=>b.date.localeCompare(a.date))[0]?.value||75;
const daysIn=Math.max(1,Math.min(90,Math.floor((new Date(today()+"T12:00:00")-new Date(state.startDate+"T12:00:00"))/86400000)+1));
const check=(name)=>Boolean(state.checks[today()]?.[name]);
const lastSets=e=>[...state.entries].filter(x=>x.exerciseId===e.id).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created)[0]?.sets||[];
const recommend=e=>{const s=lastSets(e);if(!s.length)return "Start with a comfortable weight, keeping 1–2 reps in reserve";const max=Math.max(...s.map(x=>number(x.kg)));const done=s.length>=e.sets&&s.slice(0,e.sets).every(x=>number(x.reps)>=e.hi&&number(x.kg)===max);return done?"Try "+(max+number(e.step,2.5))+" kg next time (if form stays controlled)":"Repeat about "+max+" kg; build toward "+e.hi+" reps on every set"};
const bar=(n,total)=>'<div class="bar"><div style="width:'+Math.min(100,Math.max(0,n/Math.max(1,total)*100))+'%"></div></div>';
const app=document.querySelector("#app");
function render(){
 const nav=[["today","⌂","Today"],["gym","▤","Gym"],["food","◉","Food"],["progress","⌁","Progress"],["settings","⚙","Customize"]];
 let content=tab==="today"?todayView():tab==="gym"?gymView():tab==="food"?foodView():tab==="progress"?progressView():settingsView();
 app.innerHTML='<header><small>90-DAY BULK COACH</small><h1>'+({today:"Your transformation",gym:"Your workouts",food:"Nutrition",progress:"Your progress",settings:"Customize your coach"}[tab])+'</h1><small>Day '+daysIn+' / 90 · '+esc(syncState)+'</small></header><main>'+content+'</main><nav>'+nav.map(([id,ico,title])=>'<button class="'+(tab===id?"active":"")+'" data-tab="'+id+'"><i>'+ico+'</i>'+title+'</button>').join("")+'</nav>';
}
function todayView(){
 const n=nutrient(),wo=workoutFor(),done=["workout","nutrition","weigh","sleep"].filter(check).length,qs=["Show up today. Consistency builds size.","Every completed set is another vote for your goal.","Don't chase motivation; follow the plan.","Small improvements compound over 90 days."];
 return '<div class="stats"><div class="stat"><small>Current weight</small><b>'+latestWeight()+' kg</b></div><div class="stat"><small>Target</small><b>'+esc(state.goal)+' kg</b></div><div class="stat"><small>Time left</small><b>'+(90-daysIn)+' days</b></div></div>'+
 '<div class="card"><h2>Today’s nutrition</h2><div class="flex space"><span>Calories</span><b>'+fmt(n.kcal)+' / '+fmt(state.calories)+'</b></div>'+bar(n.kcal,state.calories)+'<div class="flex space"><span>Protein</span><b>'+fmt(n.p)+' / '+fmt(state.protein)+' g</b></div>'+bar(n.p,state.protein)+'<button class="btn secondary" data-tab="food">Log a meal</button></div>'+
 '<div class="card"><h2>Today’s workout</h2><h3>'+(wo?esc(wo):"Recovery day")+'</h3><p class="muted">'+(wo?"Your scheduled training session.":"Use today to recover. You can also choose another training day.")+'</p><button class="btn" data-tab="gym">'+(wo?"Start logging":"View gym plan")+'</button></div>'+
 '<div class="card"><h2>Daily checklist</h2>'+[["workout","Workout completed"],["nutrition","Hit calorie & protein targets"],["weigh","Weigh-in logged"],["sleep","Sleep and recovery checked"]].map(([id,name])=>'<label class="row"><span>'+name+'</span><input type="checkbox" data-check="'+id+'" '+(check(id)?"checked":"")+'></label>').join("")+'<p class="muted">'+done+' of 4 completed</p>'+bar(done,4)+'</div><div class="card"><small>DAILY MOTIVATION</small><p class="quote">“'+qs[daysIn%qs.length]+'”</p></div>';
}
function gymView(){
 const select='<select data-workout-select>'+state.workouts.map(w=>'<option '+(activeWorkout===w[0]?"selected":"")+' value="'+esc(w[0])+'">'+esc(w[0])+' · '+esc(w[1])+'</option>').join("")+'</select>';
 const rows=state.exercises.filter(e=>e.day===activeWorkout);
 return '<div class="card"><div class="flex space"><h2>Workout day</h2>'+select+'</div><p class="hint">Log each working set after you finish it. Increase weight when all sets reach the top of the rep range with controlled form.</p></div>'+
 '<div class="card">'+rows.map(e=>{const prev=lastSets(e),w=prev[0]?.kg||"",reps=prev[0]?.reps||"";return '<div class="exercise"><div class="flex space"><b>'+esc(e.name)+'</b><button class="link" data-edit="exercise" data-id="'+e.id+'">Edit</button></div><small>'+e.sets+' sets · '+e.lo+'–'+e.hi+' reps · '+esc(e.step)+' kg steps</small><p class="green tiny">'+esc(recommend(e))+'</p><form data-form="log-set" data-id="'+e.id+'"><div class="fields"><div><label>Weight (kg)</label><input name="kg" inputmode="decimal" type="number" min="0" max="1000" step="0.5" value="'+esc(w)+'" required></div><div><label>Reps</label><input name="reps" inputmode="numeric" type="number" min="1" max="100" step="1" value="'+esc(reps)+'" required></div></div><div class="flex space" style="margin-top:9px"><button class="btn secondary" type="submit">Log set</button><small>Today: '+state.entries.filter(x=>x.exerciseId===e.id&&x.date===today()).reduce((a,x)=>a+x.sets.length,0)+' set(s)</small></div></form><button class="link" data-history="'+e.id+'">View history</button></div>'}).join("")+'<button class="btn" data-add="exercise">+ Add exercise</button></div>'+
 '<div class="card"><h2>Edit workout days</h2>'+state.workouts.map((w,i)=>'<div class="row"><span>'+esc(w[0])+' <small>'+esc(w[1])+'</small></span><button class="link" data-edit="workout" data-id="'+i+'">Edit</button></div>').join("")+'</div>';
}
function foodView(){
 const n=nutrient();
 return '<div class="card"><h2>Daily totals</h2>'+[["Calories",n.kcal,state.calories,"kcal"],["Protein",n.p,state.protein,"g"],["Carbs",n.c,440,"g"],["Fat",n.f,100,"g"]].map(([label,value,target,unit])=>'<div class="flex space"><span>'+label+'</span><b>'+fmt(value)+' / '+fmt(target)+' '+unit+'</b></div>'+bar(value,target)).join("")+'</div>'+
 '<div class="card"><h2>Add food to today</h2><form data-form="meal"><label>Food / recipe</label><select name="foodId" required>'+state.foods.map(f=>'<option value="'+f.id+'">'+esc(f.name)+' · '+esc(f.portion)+'</option>').join("")+'</select><div class="fields"><div><label>Servings</label><input name="servings" type="number" min=".1" max="100" step=".1" value="1" required></div><div><label>&nbsp;</label><button class="btn" style="width:100%" type="submit">Log meal</button></div></div></form></div>'+
 '<div class="card"><h2>Today’s meals</h2>'+(getDailyMeals().length?getDailyMeals().map(m=>{const f=state.foods.find(x=>x.id===m.foodId);return '<div class="row"><div><b>'+esc(f?.name||"Deleted food")+'</b><br><small>'+m.servings+' servings · '+fmt(number(f?.kcal)*m.servings)+' kcal</small></div><button class="link" data-delete="meal" data-id="'+m.id+'">Remove</button></div>'}).join(""):'<p class="muted">No food logged today.</p>')+'</div>'+
 '<div class="card"><div class="flex space"><h2>My foods & recipes</h2><button class="btn" data-add="food">+ Add</button></div>'+state.foods.map(f=>'<div class="row"><div><b>'+esc(f.name)+'</b><br><small>'+fmt(f.kcal)+' kcal · '+fmt(f.p)+' g protein / '+esc(f.portion)+'</small></div><button class="link" data-edit="food" data-id="'+f.id+'">Edit</button></div>').join("")+'</div>';
}
function progressView(){
 const sorted=[...state.weights].sort((a,b)=>a.date.localeCompare(b.date)),last=sorted.slice(-10);
 const chart=last.length>=2?'<svg class="chart" viewBox="0 0 320 120" role="img" aria-label="Weight trend"><polyline fill="none" stroke="#64d5a0" stroke-width="3" points="'+last.map((w,i)=>{const vals=last.map(x=>number(x.value)),min=Math.min(...vals)-.5,max=Math.max(...vals)+.5;return (10+i*300/(last.length-1)).toFixed(1)+","+(100-(number(w.value)-min)/(max-min)*85).toFixed(1)}).join(" ")+'"/></svg>':'<p class="muted">Add two weigh-ins to see a trend.</p>';
 return '<div class="card"><h2>Weight</h2><div class="stats"><div class="stat"><small>Start</small><b>75 kg</b></div><div class="stat"><small>Latest</small><b>'+latestWeight()+' kg</b></div><div class="stat"><small>Goal</small><b>'+esc(state.goal)+' kg</b></div></div>'+chart+'<form data-form="weight"><div class="fields"><div><label>Date</label><input name="date" type="date" value="'+today()+'" required></div><div><label>Weight (kg)</label><input name="value" type="number" min="20" max="400" step=".1" inputmode="decimal" required></div></div><p><button class="btn">Save weigh-in</button></p></form>'+sorted.slice().reverse().slice(0,8).map(w=>'<div class="row"><span>'+esc(w.date)+' · '+esc(w.value)+' kg</span><button class="link" data-delete="weight" data-id="'+w.id+'">Delete</button></div>').join("")+'</div>'+
 '<div class="card"><h2>Body measurements</h2><form data-form="measurement"><label>Measurement</label><select name="part">'+["Arms","Chest","Waist","Shoulders","Thighs","Calves"].map(p=>'<option>'+p+'</option>').join("")+'</select><div class="fields"><div><label>Centimeters</label><input name="value" type="number" min="1" max="300" step=".1" required></div><div><label>Date</label><input name="date" type="date" value="'+today()+'" required></div></div><p><button class="btn">Save measurement</button></p></form>'+state.measurements.slice(-8).reverse().map(m=>'<div class="row"><span>'+esc(m.part)+' · '+esc(m.value)+' cm <small>'+esc(m.date)+'</small></span><button class="link" data-delete="measurement" data-id="'+m.id+'">Delete</button></div>').join("")+'</div>'+
 '<div class="card"><h2>Custom tracking</h2>'+state.fields.map(f=>'<form class="row" data-form="fieldlog" data-id="'+f.id+'"><label>'+esc(f.name)+' ('+esc(f.unit)+')</label><input aria-label="'+esc(f.name)+'" type="number" step="any" name="value" required style="width:95px"><button class="btn secondary">Save</button></form>').join("")+'<button class="btn secondary" data-add="field">+ Add custom field</button>'+state.fieldLogs.slice(-8).reverse().map(x=>{const f=state.fields.find(y=>y.id===x.fieldId);return '<div class="row"><span>'+esc(f?.name||"Removed field")+' · '+esc(x.value)+' '+esc(f?.unit||"")+'</span><small>'+esc(x.date)+'</small></div>'}).join("")+'</div>';
}
function settingsView(){
 const pushAvailable=Boolean(CFG.pushAppId),cloud=Boolean(CFG.storageApi);
 return '<div class="card"><h2>Your targets</h2><form data-form="targets"><div class="fields"><div><label>Calories / day</label><input name="calories" type="number" min="1000" max="10000" value="'+state.calories+'"></div><div><label>Protein (g)</label><input name="protein" type="number" min="20" max="500" value="'+state.protein+'"></div><div><label>Target weight (kg)</label><input name="goal" type="number" step=".1" min="30" max="400" value="'+state.goal+'"></div><div><label>90-day start</label><input type="date" name="startDate" value="'+state.startDate+'"></div></div><p><button class="btn">Save targets</button></p></form></div>'+
 '<div class="card"><div class="flex space"><h2>My reminders</h2><button class="btn" data-add="reminder">+ Add</button></div>'+state.reminders.map(r=>'<div class="row"><div><b>'+esc(r.name)+'</b><br><small>'+esc(r.time)+' · '+(r.days==="training"?"Training days":"Every day")+'</small></div><div class="actions"><input type="checkbox" aria-label="Enable '+esc(r.name)+'" data-reminder-toggle="'+r.id+'" '+(r.enabled?"checked":"")+'><button class="link" data-edit="reminder" data-id="'+r.id+'">Edit</button></div></div>').join("")+'<p class="hint">Reminder settings are saved now. Push delivery requires an installed iPhone PWA, permission, an active OneSignal app, and a scheduled server sender.</p><button class="btn secondary" data-push '+(!pushAvailable?"disabled":"")+'>'+(pushAvailable?"Enable push notifications":"Push not configured yet")+'</button><p class="hint">'+esc(pushState)+'</p></div>'+
 '<div class="card"><h2>Manage your app</h2><p><button class="btn secondary" data-add="exercise">+ Exercise</button> <button class="btn secondary" data-add="food">+ Food</button></p><p><button class="btn secondary" data-add="field">+ Tracking field</button> <button class="btn secondary" data-add="reminder">+ Reminder</button></p><hr class="divider"><p class="muted">Local tracking works on this iPhone. '+(cloud?"Cloud sync: "+esc(syncState):"Cloudflare D1 sync will become available after deployment configuration.")+'</p><div class="actions"><button class="btn secondary" data-export>Export backup</button><label class="btn secondary" for="import-file" style="margin:0">Import backup</label><input type="file" id="import-file" accept="application/json" style="display:none"></div></div>'+
 '<div class="card"><h2>Install on iPhone</h2><p class="hint">Open this site in Safari, tap Share → Add to Home Screen, then launch it from the new Home Screen icon. iPhone Web Push requires iOS 16.4+ and the Home Screen app.</p></div>';
}
function showEditor(kind,id){
 let obj=kind==="workout"?state.workouts[number(id)]:state[kind==="exercise"?"exercises":kind==="food"?"foods":kind==="reminder"?"reminders":"fields"].find(x=>x.id===id);
 editing={kind,id};
 const text=(name,val,label,type="text",extra="")=>'<div><label>'+label+'</label><input name="'+name+'" type="'+type+'" value="'+esc(val??"")+'" '+extra+' required></div>';
 let body="";
 if(kind==="exercise")body=text("name",obj?.name,"Exercise")+ '<div><label>Workout</label><select name="day">'+state.workouts.map(x=>'<option '+(obj?.day===x[0]?"selected":"")+'>'+esc(x[0])+'</option>').join("")+'</select></div><div class="fields">'+text("sets",obj?.sets||3,"Working sets","number",'min="1" max="12"')+text("lo",obj?.lo||8,"Min reps","number",'min="1" max="50"')+text("hi",obj?.hi||12,"Max reps","number",'min="1" max="50"')+text("step",obj?.step||2.5,"Increase (kg)","number",'min=".1" max="100" step=".1"')+'</div>';
 if(kind==="food")body=text("name",obj?.name,"Food name")+text("portion",obj?.portion||"1 serving","Portion")+"<div class='fields'>"+text("kcal",obj?.kcal||0,"Calories","number",'min="0" step=".1"')+text("p",obj?.p||0,"Protein (g)","number",'min="0" step=".1"')+text("c",obj?.c||0,"Carbs (g)","number",'min="0" step=".1"')+text("f",obj?.f||0,"Fat (g)","number",'min="0" step=".1"')+"</div>";
 if(kind==="reminder")body=text("name",obj?.name,"Reminder name")+text("time",obj?.time||"14:30","Time","time")+'<div><label>When</label><select name="days"><option value="every" '+(obj?.days==="every"?"selected":"")+'>Every day</option><option value="training" '+(obj?.days==="training"?"selected":"")+'>Training days</option></select></div>';
 if(kind==="field")body=text("name",obj?.name,"Tracking field name")+text("unit",obj?.unit||"units","Units");
 if(kind==="workout")body=text("name",obj?.[0],"Workout name")+'<div><label>Day</label><select name="day">'+["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d=>'<option '+(obj?.[1]===d?"selected":"")+'>'+d+'</option>').join("")+'</select></div>';
 const div=document.createElement("div");div.id="editor";div.innerHTML='<div class="card"><div class="flex space"><h2>'+(id!==undefined?"Edit ":"Add ")+esc(kind)+'</h2><button class="btn secondary" data-cancel>Close</button></div><form data-form="editor">'+body+'<p><button class="btn">Save</button> '+(id!==undefined&&kind!=="workout"?'<button type="button" class="btn danger" data-remove-editor>Delete</button>':"")+'</p></form></div>';
 app.querySelector("main").prepend(div);div.scrollIntoView({behavior:"smooth",block:"start"});
}
function entriesForm(e){
 const f=new FormData(e.target),kind=e.target.dataset.form,id=e.target.dataset.id;
 if(kind==="log-set"){const kg=number(f.get("kg")),reps=number(f.get("reps"));if(kg<0||reps<1)return;state.entries.push({id:uid(),exerciseId:id,date:today(),created:Date.now(),sets:[{kg,reps}]});}
 else if(kind==="meal"){state.meals.push({id:uid(),date:today(),foodId:f.get("foodId"),servings:number(f.get("servings"),1)});}
 else if(kind==="weight"){state.weights.push({id:uid(),date:f.get("date"),value:number(f.get("value"))});}
 else if(kind==="measurement"){state.measurements.push({id:uid(),date:f.get("date"),part:f.get("part"),value:number(f.get("value"))});}
 else if(kind==="fieldlog"){state.fieldLogs.push({id:uid(),date:today(),fieldId:id,value:number(f.get("value"))});}
 else if(kind==="targets"){state.calories=number(f.get("calories"),3300);state.protein=number(f.get("protein"),160);state.goal=number(f.get("goal"),79);state.startDate=f.get("startDate")||today();}
 else if(kind==="editor"){
   if(!editing)return;const {kind:k,id:editId}=editing, collection=k==="exercise"?"exercises":k==="food"?"foods":k==="reminder"?"reminders":"fields";
   if(k==="workout"){const i=number(editId),old=state.workouts[i][0],name=String(f.get("name")).trim();if(!name)return;state.workouts[i]=[name,f.get("day")];state.exercises.filter(x=>x.day===old).forEach(x=>x.day=name);activeWorkout=name;}
   else {const obj={id:editId||uid()};for(const [key,value] of f.entries())obj[key]=["sets","lo","hi","step","kcal","p","c","f"].includes(key)?number(value):String(value).trim();if(!obj.name)return;if(k==="exercise"&&obj.hi<obj.lo){alert("Maximum reps must be at least minimum reps.");return}if(k==="reminder")obj.enabled=state.reminders.find(x=>x.id===editId)?.enabled??true;
      const i=state[collection].findIndex(x=>x.id===editId);if(i>=0)state[collection][i]=obj;else state[collection].push(obj);
   }editing=null;
 }
 store();
}
app.addEventListener("submit",e=>{if(!e.target.matches("form[data-form]"))return;e.preventDefault();entriesForm(e)});
app.addEventListener("change",async e=>{
 if(e.target.dataset.workoutSelect){activeWorkout=e.target.value;render()}
 if(e.target.dataset.check){state.checks[today()] ||= {};state.checks[today()][e.target.dataset.check]=e.target.checked;store()}
 if(e.target.dataset.reminderToggle){const r=state.reminders.find(x=>x.id===e.target.dataset.reminderToggle);if(r){r.enabled=e.target.checked;store()}}
 if(e.target.id==="import-file"){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||!Array.isArray(data.exercises)||!Array.isArray(data.foods)||!Array.isArray(data.reminders))throw Error("Invalid backup");if(confirm("Replace all current Bulk Coach records with this backup?")){state={...defaultData(),...data};store()}}catch(err){alert("Could not import backup: "+err.message)}}
});
app.addEventListener("click",e=>{
 const button=e.target.closest("button");if(!button)return;
 if(button.dataset.tab){tab=button.dataset.tab;render()}
 if(button.dataset.add)showEditor(button.dataset.add);
 if(button.dataset.edit)showEditor(button.dataset.edit,button.dataset.id);
 if(button.hasAttribute("data-cancel")){document.querySelector("#editor")?.remove();editing=null}
 if(button.hasAttribute("data-remove-editor")&&editing){const {kind,id}=editing;if(confirm("Delete this "+kind+"?")){const name=kind==="exercise"?"exercises":kind==="food"?"foods":kind==="reminder"?"reminders":"fields";state[name]=state[name].filter(x=>x.id!==id);editing=null;store()}}
 if(button.dataset.delete){const kind=button.dataset.delete,name=kind==="meal"?"meals":kind==="weight"?"weights":"measurements";state[name]=state[name].filter(x=>x.id!==button.dataset.id);store()}
 if(button.dataset.history){const e1=state.exercises.find(x=>x.id===button.dataset.history);const rec=state.entries.filter(x=>x.exerciseId===e1?.id).slice(-12);alert((e1?.name||"Exercise")+"\n"+(rec.map(x=>x.date+": "+x.sets.map(s=>s.kg+" kg × "+s.reps).join(", ")).join("\n")||"No sessions yet"))}
 if(button.hasAttribute("data-export")){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="bulk-coach-backup-"+today()+".json";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),5000)}
 if(button.hasAttribute("data-push"))enablePush();
});
async function cloudSync(){
 if(!CFG.storageApi)return;try{const res=await fetch(CFG.storageApi,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({state})});if(!res.ok)throw Error("HTTP "+res.status);syncState="Cloud synced";remoteReady=true;render()}catch(err){syncState="Saved on device · sync pending";render()}}
function scheduleSync(){if(!remoteReady||!CFG.storageApi)return;clearTimeout(writeTimer);writeTimer=setTimeout(cloudSync,1200)}
async function initializeCloud(){
 if(!CFG.storageApi)return;try{const res=await fetch(CFG.storageApi,{cache:"no-store"});if(!res.ok)throw Error("HTTP "+res.status);const data=await res.json();if(data.state&&number(data.state.updatedAt)>number(state.updatedAt)){state={...defaultData(),...data.state};localStorage.setItem(KEY,JSON.stringify(state))}remoteReady=true;syncState="Cloud connected";render();if(!data.state||number(state.updatedAt)>number(data.state.updatedAt))await cloudSync()}catch{syncState="Saved on device · cloud unavailable";render()}}
async function enablePush(){
 if(!CFG.pushAppId){alert("Push notifications are not configured on the server yet.");return}
 if(!window.matchMedia("(display-mode: standalone)").matches){alert("First open this site from its Home Screen icon on iPhone.");return}
 try{
   if(!("Notification" in window))throw Error("Push is not supported in this browser.");
   if(!window.OneSignalDeferred){const s=document.createElement("script");s.src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";s.defer=true;document.head.append(s)}
   await new Promise((resolve,reject)=>{let count=0;const timer=setInterval(()=>{if(window.OneSignalDeferred){clearInterval(timer);resolve()}else if(++count>50){clearInterval(timer);reject(Error("OneSignal failed to load"))}},100)});
   window.OneSignalDeferred.push(async OneSignal=>{await OneSignal.init({appId:CFG.pushAppId,serviceWorkerPath:"sw.js",serviceWorkerParam:{scope:"/"}});await OneSignal.Notifications.requestPermission();pushState=Notification.permission==="granted"?"Push permission granted. Scheduled delivery requires server setup.":"Notification permission not granted";render()})
 }catch(e){pushState=e.message;render()}
}
render();initializeCloud();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
