const earth=6371000;
export function distance(a,b){
 const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
 const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
 return 2*earth*Math.asin(Math.sqrt(x));
}
export function cleanTrack(input,{lastMovement=false}={}){
 const ordered=[...input].filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Number.isFinite(new Date(p.t).getTime())).sort((a,b)=>new Date(a.t)-new Date(b.t));
 const withoutSpikes=ordered.filter((p,i,a)=>i===0||i===a.length-1||!(distance(a[i-1],p)>60&&distance(a[i-1],a[i+1])<20));
 let points=withoutSpikes;
 if(lastMovement&&points.length){
   let end=points.length-1;while(end>0&&Number(points[end].speed)<=1&&distance(points[end-1],points[end])<6)end--;
   let start=end,quiet=0;for(let i=end;i>0;i--){const moving=Number(points[i].speed)>1||distance(points[i-1],points[i])>=6;quiet=moving?0:quiet+1;if(quiet>=20){start=i+20;break;}start=i-1;}points=points.slice(Math.max(0,start),end+1);
 }
 if(points.length<3)return points;
 // Simplify stationary jitter without destroying temporal continuity. Keeping a
 // real sample at least once a minute prevents splitTrack from turning a stop
 // with valid GPS reception into several disconnected route segments.
 const result=[points[0]];for(let i=1;i<points.length-1;i++){const p=points[i],last=result.at(-1),elapsed=new Date(p.t)-new Date(last.t);if(Number(p.speed)>1||distance(last,p)>=20||elapsed>=60000)result.push(p);}result.push(points.at(-1));return result;
}
export function splitTrack(points,{maxGapMs=120000,maxSpeedKmh=45}={}){
 const segments=[];let segment=[];
 for(const point of points){const last=segment.at(-1);if(last){const elapsed=new Date(point.t)-new Date(last.t),meters=distance(last,point),speed=elapsed>0?meters/(elapsed/1000)*3.6:Infinity;if(elapsed>maxGapMs||elapsed<=0||speed>maxSpeedKmh){if(segment.length>1)segments.push(segment);segment=[];}}segment.push(point);}
 if(segment.length>1)segments.push(segment);return segments;
}
