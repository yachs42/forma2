/**
 * FORMA Studio — ONLY FILE TO REPLACE WHEN CHANGING ENGINEERING CALCULATIONS.
 * Works offline on Windows, Linux and РЕД ОС; no npm, Python or server.
 *
 * API: window.FormaPhysics.calculatePhysics(project) => {
 *   metrics: {groundArea,upperArea,totalArea,rooms,totalWallLength,loadKN,
 *      soilPressureKPa,soilUtilization,estimatedHeatKW,criticalCount,warningCount},
 *   issues: [{severity:'critical'|'warning'|'success'|'info',title,detail,tag}],
 *   heating: [{roomId,floor,name,area,heatedArea,heatNeedW,estimatedPowerW,
 *      pipeLengthM,loops,spacingM,coverage}],
 *   assumptions: ['...']
 * }
 * 
 * To connect a professional engine, REPLACE ONLY the implementation of
 * calculatePhysics(project) below. Keep the return format unchanged.
 * This file performs ILLUSTRATIVE COLLEGE calculations, not safe building design.
 */
(function () {
  'use strict';
  const CONFIG = {
    wallHeight: 2.78, floorDeadLoad: 3.0, occupancyLoad: 2.0,
    roofLoad: 1.2, heatingOutput: 80, pipeSpacing: .15,
    materialDensity: {aerated:600, brick:1800, timber:500, concrete:2400}
  };
  const round=(n,d=2)=>Number(n.toFixed(d));
  const area=r=>r.w*r.h;
  const intersect=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  function unionArea(rs){
    if(!rs.length)return 0;
    const xs=[...new Set(rs.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b);
    let total=0;
    for(let i=0;i<xs.length-1;i++){
      const x=(xs[i]+xs[i+1])/2;
      const intervals=rs.filter(r=>x>r.x&&x<r.x+r.w).map(r=>[r.y,r.y+r.h]).sort((a,b)=>a[0]-b[0]);
      let h=0,last=-Infinity;
      for(const [a,b] of intervals){h+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}
      total+=(xs[i+1]-xs[i])*h;
    }
    return total;
  }
  function wallsOf(rs){
    const wallLines=[];
    for(const r of rs){
      for(const [dir,c,a,b] of [['h',r.y,r.x,r.x+r.w],['h',r.y+r.h,r.x,r.x+r.w],['v',r.x,r.y,r.y+r.h],['v',r.x+r.w,r.y,r.y+r.h]]){
        const match=wallLines.find(w=>w.dir===dir&&Math.abs(w.c-c)<.015&&a<=w.b+.015&&b>=w.a-.015);
        if(match){match.a=Math.min(match.a,a);match.b=Math.max(match.b,b);match.count++}
        else wallLines.push({dir,c,a,b,count:1});
      }
    }
    return wallLines;
  }
  // ===== REPLACE THIS FUNCTION TO USE A COMPANY'S ENGINE =====
  function calculatePhysics(project){
    const p=project.settings;
    const ground=project.rooms.filter(r=>r.floor===0);
    const upper=project.rooms.filter(r=>r.floor===1);
    const a0=unionArea(ground),a1=unionArea(upper);
    const walls0=wallsOf(ground),walls1=wallsOf(upper),walls=[...walls0,...walls1];
    const length=walls.reduce((sum,w)=>sum+w.b-w.a,0);
    const outLength=walls0.filter(w=>w.count===1).reduce((sum,w)=>sum+w.b-w.a,0);
    const density=CONFIG.materialDensity[p.material]||CONFIG.materialDensity.aerated;
    const wallLoad=length*p.wallThickness*CONFIG.wallHeight*density*9.81/1000;
    const floorLoad=(a0+a1)*(CONFIG.floorDeadLoad+CONFIG.occupancyLoad);
    const roofLoad=Math.max(a0,a1)*CONFIG.roofLoad;
    const baseLoad=p.foundationType==='strip' ? outLength*(p.stripWidth||.65)*.48*2400*9.81/1000 : a0*.28*2400*9.81/1000;
    const load=wallLoad+floorLoad+roofLoad+baseLoad;
    const baseArea=p.foundationType==='strip'?outLength*(p.stripWidth||.65):a0;
    const pressure=baseArea>0?load/baseArea:0;
    const utilization=p.soilBearing>0?pressure/p.soilBearing*100:0;
    const issues=[];
    const issue=(severity,title,detail,tag='Конструкция')=>issues.push({severity,title,detail,tag});
    if(!ground.length)issue('critical','Нет первого этажа','Нужна площадь первого этажа для расчёта опирания.');
    for(const floor of [0,1]){
      const rooms=floor===0?ground:upper;
      for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
        const overlap=intersect(rooms[i],rooms[j]);
        if(overlap>.03)issue('critical','Комнаты пересекаются',`${rooms[i].name} и ${rooms[j].name}: ${round(overlap)} м².`,'Планировка');
      }
    }
    if(upper.length){
      const supported=upper.reduce((s,r)=>s+ground.reduce((t,g)=>t+intersect(r,g),0),0);
      if(supported<a1*.95)issue('critical','Второй этаж выходит за опоры','Площадь второго этажа не полностью находится над первым. Требуется расчёт несущей схемы.','Перекрытие');
    }
    if(utilization>100)issue('critical','Высокое среднее давление на грунт',`${round(pressure,1)} кПа превышает заданные ${p.soilBearing} кПа.`,'Фундамент');
    else if(utilization>75)issue('warning','Малый запас по условному давлению',`${round(utilization)}% от заданного предела. Нужен профессиональный расчёт.`,'Фундамент');
    else if(a0)issue('success','Учебная проверка давления',`${round(pressure,1)} кПа при заданном пределе ${p.soilBearing} кПа.`,'Фундамент');
    if(p.foundationType==='strip')issue('warning','Упрощённый ленточный фундамент','Силы не распределены по отдельным стенам.','Фундамент');
    if(p.wallThickness<.2)issue('warning','Тонкие стены','Нужна отдельная проверка теплотехники и прочности.','Материалы');
    if(!project.openings.some(o=>o.kind==='door'&&o.floor===0))issue('warning','Нет дверей','Добавь вход и проходы между помещениями.','Планировка');
    for(const r of project.rooms)if(r.w<1.3||r.h<1.3)issue('warning',`Узкая комната: ${r.name}`,'Одна из сторон меньше 1,3 метра.','Эргономика');
    const heating=[];
    if(p.heating){
      for(const r of project.rooms){
        const gross=area(r),heatedArea=round(gross*(r.type==='kitchen'?.65:r.type==='bathroom'?.64:.78));
        const heatNeedW=round(gross*(p.heatDemand||60)),estimatedPowerW=round(heatedArea*CONFIG.heatingOutput);
        const pipeLengthM=round(heatedArea/CONFIG.pipeSpacing*1.08+5,1),loops=Math.max(1,Math.ceil(pipeLengthM/85));
        heating.push({roomId:r.id,floor:r.floor,name:r.name,area:gross,heatedArea,heatNeedW,estimatedPowerW,pipeLengthM,loops,spacingM:CONFIG.pipeSpacing,coverage:heatedArea/gross});
        if(estimatedPowerW<heatNeedW)issue('warning',`Мало тепла: ${r.name}`,'Возможно, потребуется дополнительный источник тепла.','Отопление');
      }
    }
    return {metrics:{groundArea:round(a0,1),upperArea:round(a1,1),totalArea:round(a0+a1,1),rooms:project.rooms.length,
      totalWallLength:round(length,1),loadKN:round(load,1),soilPressureKPa:round(pressure,1),soilUtilization:round(utilization),
      estimatedHeatKW:round(heating.reduce((s,h)=>s+h.heatNeedW,0)/1000,2),
      criticalCount:issues.filter(i=>i.severity==='critical').length,
      warningCount:issues.filter(i=>i.severity==='warning').length},issues,heating,
      assumptions:['Учебные ориентировочные расчёты, не пригодны для строительства.',
      'Нагрузки перекрытий и кровли приняты условно. Ветер, снег, армирование, грунтовые воды и осадки не рассчитаны.',
      'Результаты используются только для демонстрации работы модульного движка.']};
  }
  window.FormaPhysics={calculatePhysics,version:'FORMA educational v8'};
})();
