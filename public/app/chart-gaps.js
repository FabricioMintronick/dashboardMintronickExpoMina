export const readingGapPlugin={id:'readingGaps',beforeDatasetsDraw(chart,_args,options){const ranges=options?.ranges||[],x=chart.scales.x,area=chart.chartArea;if(!x||!area||!ranges.length)return;const {ctx}=chart;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${chart.width<=900?13:11}px sans-serif`;for(const range of ranges){const left=Math.max(area.left,x.getPixelForValue(range.from)),right=Math.min(area.right,x.getPixelForValue(range.to));if(right<=left)continue;ctx.fillStyle='rgba(126,137,139,.22)';ctx.fillRect(left,area.top,right-left,area.bottom-area.top);ctx.strokeStyle='rgba(126,137,139,.55)';ctx.setLineDash([4,4]);ctx.strokeRect(left+.5,area.top+.5,right-left-1,area.bottom-area.top-1);ctx.setLineDash([]);if(right-left>=112){ctx.fillStyle='#aeb9ba';ctx.fillText('Sin lectura registrada',(left+right)/2,(area.top+area.bottom)/2);}}ctx.restore();}};

export function seriesWithGaps(samples,from,to,gapAfterMs){
 const start=new Date(from).getTime(),end=new Date(to).getTime(),threshold=Math.max(1,Number(gapAfterMs))*1.75;
 const ordered=samples.map(p=>({...p,time:new Date(p.t).getTime()})).filter(p=>Number.isFinite(p.time)).sort((a,b)=>a.time-b.time);
 const valid=ordered.filter(p=>Number.isFinite(p.v)),gaps=[];
 if(!valid.length)return {series:ordered.map(p=>({x:p.time,y:null})),gaps:[{from:start,to:end}]};
 if(valid[0].time-start>threshold)gaps.push({from:start,to:valid[0].time});
 for(let i=1;i<valid.length;i++)if(valid[i].time-valid[i-1].time>threshold)gaps.push({from:valid[i-1].time,to:valid[i].time});
 if(end-valid.at(-1).time>threshold)gaps.push({from:valid.at(-1).time,to:end});
 const internalGaps=gaps.filter(gap=>gap.from>start&&gap.to<end);
 const series=ordered.map(p=>({x:p.time,y:Number.isFinite(p.v)?p.v:null}));
 for(const gap of internalGaps)series.push({x:gap.from+(gap.to-gap.from)/2,y:null});
 series.sort((a,b)=>a.x-b.x);
 return {series,gaps};
}
