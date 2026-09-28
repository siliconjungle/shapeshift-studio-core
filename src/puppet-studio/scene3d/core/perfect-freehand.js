/*! Perfect Freehand 1.2.3 — shader port
MIT License

Copyright (c) 2021 Stephen Ruiz Ltd

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/** GPU port of Perfect Freehand 1.2.3's default stroke construction.
 * Copyright (c) 2021 Stephen Ruiz Ltd. MIT; see perfect-freehand.LICENSE.
 * Input normalisation, getStrokePoints, pressure, thinning, outline filtering,
 * sharp-corner arcs, caps and default taper easing run in the fragment shader.
 * Polygon coverage is evaluated directly, avoiding CPU outline triangulation.
 * Each draw accepts up to 48 input points. Longer paths use overlapping draws.
 */
export const PERFECT_FREEHAND_MAX_POINTS=48;
export const perfectFreehandVertex=`void main(){gl_Position=vec4(position,1.);}`;
export const perfectFreehandFragment=`
precision highp float;
uniform vec4 inputPoints[48]; // projected pixel x/y, pressure, NDC depth
uniform vec3 restPoints[48]; // stable object coordinates for optional input variation
uniform int inputCount;
uniform float size,thinning,smoothing,streamline,simulatePressure,complete;
uniform float taperStart,taperEnd,capStart,capEnd,variation,seed,pass,depthBias;
uniform vec3 ink;
const float PI=3.141692653589793;
vec4 points[48];vec2 vectors[48];float distances[48],running[48];int count;
float nearestDistance,nearestDepth;vec4 crossingsA,crossingsB;
vec2 firstLeft,firstRight,previousLeft,previousRight;float firstLeftZ,firstRightZ,previousLeftZ,previousRightZ;
bool haveLeft,haveRight;
vec2 perpendicular(vec2 p){return vec2(p.y,-p.x);}
vec2 unit(vec2 p){return p/max(length(p),.0000001);}
vec2 rotatePoint(vec2 p,vec2 center,float angle){vec2 d=p-center;float c=cos(angle),s=sin(angle);return center+vec2(c*d.x-s*d.y,s*d.x+c*d.y);}
float pressureStep(float previous,float distance){float speed=min(1.,distance/max(size,.000001)),rate=min(1.,1.-speed);return min(1.,previous+(rate-previous)*(speed*.275));}
float strokeRadius(float pressure){return size*(.5-thinning*(.5-pressure));}
vec4 rawPoint(int i){
 vec4 p=inputPoints[i];
 if(variation>0.){
  vec2 direction=unit(inputPoints[min(inputCount-1,i+1)].xy-inputPoints[max(0,i-1)].xy);
  float phase=dot(restPoints[i],vec3(3.7,5.3,2.9))+seed;
  p.xy+=perpendicular(direction)*(sin(phase)+.38*sin(phase*2.31+1.7))*size*variation*.23;
  p.z=clamp(p.z+variation*.36*sin(phase*1.43+.4),0.,1.);
 }
 return p;
}
vec4 normalisedInput(int i){
 if(inputCount==1){vec4 p=rawPoint(0);if(i>0)p.xy+=vec2(1.);return p;}
 if(inputCount==2&&i>0){vec4 p=mix(rawPoint(0),rawPoint(1),float(i)/4.);p.z=.5;return p;}
 return rawPoint(i);
}
void buildPoints(){
 int inputLength=inputCount==1?2:inputCount==2?5:inputCount;
 vec4 first=normalisedInput(0);if(first.z<0.)first.z=.25;
 points[0]=first;vectors[0]=vec2(1.);distances[0]=0.;running[0]=0.;count=1;
 float t=.15+(1.-streamline)*.85,total=0.;bool reached=false;
 for(int i=1;i<48;i++){
  if(i>=inputLength)break;vec4 raw=normalisedInput(i),previous=points[count-1],p=raw;
  if(!(complete>.5&&i==inputLength-1)){p.xy=mix(previous.xy,raw.xy,t);p.w=mix(previous.w,raw.w,t);}
  if(all(equal(previous.xy,p.xy)))continue;
  float distance=length(p.xy-previous.xy);total+=distance;
  if(i<inputLength-1&&!reached){if(total<size)continue;reached=true;}
  if(p.z<0.)p.z=.5;points[count]=p;vectors[count]=unit(previous.xy-p.xy);distances[count]=distance;running[count]=total;count++;
 }
 vectors[0]=count>1?vectors[1]:vec2(0.);
}
float crossing(vec2 q,vec2 a,vec2 b){if((a.y>q.y)!=(b.y>q.y))if(q.x<(b.x-a.x)*(q.y-a.y)/(b.y-a.y)+a.x)return b.y>a.y?1.:-1.;return 0.;}
void edge(vec2 a,vec2 b,float za,float zb){
 vec2 q=gl_FragCoord.xy,d=b-a;float t=clamp(dot(q-a,d)/max(dot(d,d),.0000001),0.,1.),distance=length(q-a-t*d);
 if(distance<nearestDistance){nearestDistance=distance;nearestDepth=mix(za,zb,t);}
 // Non-zero winding at eight subpixel positions avoids antialias seams at
 // overlapping caps and sharp corners inside an otherwise solid stroke.
 crossingsA+=vec4(crossing(q+vec2(-.375,-.125),a,b),crossing(q+vec2(-.125,.375),a,b),crossing(q+vec2(.125,-.375),a,b),crossing(q+vec2(.375,.125),a,b));
 crossingsB+=vec4(crossing(q+vec2(-.375,.375),a,b),crossing(q+vec2(-.125,-.125),a,b),crossing(q+vec2(.125,.125),a,b),crossing(q+vec2(.375,-.375),a,b));
}
void leftPoint(vec2 p,float z){if(haveLeft)edge(previousLeft,p,previousLeftZ,z);else{firstLeft=p;firstLeftZ=z;haveLeft=true;}previousLeft=p;previousLeftZ=z;}
void rightPoint(vec2 p,float z){if(haveRight)edge(p,previousRight,z,previousRightZ);else{firstRight=p;firstRightZ=z;haveRight=true;}previousRight=p;previousRightZ=z;}
void main(){
 if(pass>.5||inputCount<1||inputCount>48||size<=0.)discard;
 nearestDistance=1e20;nearestDepth=0.;crossingsA=vec4(0.);crossingsB=vec4(0.);haveLeft=false;haveRight=false;
 buildPoints();float total=running[count-1],minimum=pow(size*smoothing,2.);
 float previousPressure=points[0].z;
 for(int i=0;i<10;i++){if(i>=count)break;float p=points[i].z;if(simulatePressure>.5)p=pressureStep(previousPressure,distances[i]);previousPressure=(previousPressure+p)*.5;}
 float radius=strokeRadius(points[count-1].z),firstRadius=-1.;vec2 previousVector=vectors[0],lastLeft=points[0].xy,lastRight=lastLeft;bool previousSharp=false;
 for(int i=0;i<48;i++){
  if(i>=count)break;vec4 p=points[i];vec2 vector=vectors[i];bool last=i==count-1;
  if(!last&&total-running[i]<3.)continue;
  float pressure=p.z;if(thinning!=0.){if(simulatePressure>.5)pressure=pressureStep(previousPressure,distances[i]);radius=strokeRadius(pressure);}else radius=size*.5;
  if(firstRadius<0.)firstRadius=radius;
  float startStrength=1.,endStrength=1.;
  if(running[i]<taperStart){float t=running[i]/taperStart;startStrength=t*(2.-t);}
  if(total-running[i]<taperEnd){float t=(total-running[i])/taperEnd-1.;endStrength=t*t*t+1.;}
  radius=max(.01,radius*min(startStrength,endStrength));
  vec2 nextVector=vectors[min(i+1,count-1)];float nextDot=last?1.:dot(vector,nextVector),previousDot=dot(vector,previousVector);
  bool sharp=previousDot<0.&&!previousSharp,nextSharp=nextDot<0.;
  if(sharp||nextSharp){vec2 offset=perpendicular(previousVector)*radius;
   for(int j=0;j<=13;j++){float t=float(j)/13.;lastLeft=rotatePoint(p.xy-offset,p.xy,PI*t);lastRight=rotatePoint(p.xy+offset,p.xy,-PI*t);leftPoint(lastLeft,p.w);rightPoint(lastRight,p.w);}
   if(nextSharp)previousSharp=true;continue;
  }
  previousSharp=false;
  if(last){vec2 offset=perpendicular(vector)*radius;leftPoint(p.xy-offset,p.w);rightPoint(p.xy+offset,p.w);continue;}
  vec2 offset=perpendicular(mix(nextVector,vector,nextDot))*radius,a=p.xy-offset,b=p.xy+offset;
  if(i<=1||dot(lastLeft-a,lastLeft-a)>minimum){leftPoint(a,p.w);lastLeft=a;}
  if(i<=1||dot(lastRight-b,lastRight-b)>minimum){rightPoint(b,p.w);lastRight=b;}
  previousPressure=pressure;previousVector=vector;
 }
 vec4 first=points[0],last=points[count-1];
 if(count==1){
  if(taperStart==0.&&taperEnd==0.||complete>.5){
   vec2 start=first.xy-unit(perpendicular(vec2(-1.)))*max(firstRadius,radius),previous=rotatePoint(start,first.xy,PI*2./13.);vec2 initial=previous;
   for(int i=2;i<=13;i++){vec2 p=rotatePoint(start,first.xy,PI*2.*float(i)/13.);edge(previous,p,first.w,first.w);previous=p;}edge(previous,initial,first.w,first.w);
  }
 }else{
  // Close left -> end cap -> reversed right -> start cap.
  vec2 previous=previousLeft;float z=previousLeftZ;
  if(taperEnd>0.){edge(previous,last.xy,z,last.w);previous=last.xy;z=last.w;}
  else if(capEnd>.5){vec2 start=last.xy+perpendicular(-vectors[count-1])*radius;for(int j=1;j<29;j++){vec2 p=rotatePoint(start,last.xy,PI*3.*float(j)/29.);edge(previous,p,z,last.w);previous=p;z=last.w;}}
  else{vec2 direction=perpendicular(-vectors[count-1]);for(int j=0;j<4;j++){float factor=j==0?1.:j==1?.99:j==2?-.99:-1.;vec2 p=last.xy+direction*radius*factor;edge(previous,p,z,last.w);previous=p;z=last.w;}}
  edge(previous,previousRight,z,previousRightZ);previous=firstRight;z=firstRightZ;
  if(taperStart==0.){
   if(capStart>.5){for(int j=1;j<=13;j++){vec2 p=rotatePoint(firstRight,first.xy,PI*float(j)/13.);edge(previous,p,z,first.w);previous=p;z=first.w;}}
   else{vec2 corners=firstLeft-firstRight;for(int j=0;j<4;j++){float factor=j==0?-.5:j==1?-.51:j==2?.51:.5;vec2 p=first.xy+corners*factor;edge(previous,p,z,first.w);previous=p;z=first.w;}}
  }
  edge(previous,firstLeft,z,firstLeftZ);
 }
 float alpha=dot(step(vec4(.5),abs(crossingsA))+step(vec4(.5),abs(crossingsB)),vec4(.125));if(alpha<=0.)discard;
 gl_FragDepth=clamp(nearestDepth*.5+.5-depthBias,0.,1.);gl_FragColor=vec4(ink,alpha);
 #include <colorspace_fragment>
}
`;
