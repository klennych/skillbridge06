import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, BriefcaseBusiness, Building2, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, Compass, Eye, EyeOff, FileCheck2, FileText, GraduationCap, LayoutDashboard, LogOut, Mail, Menu, Search, Settings as SettingsIcon, ShieldCheck, Target, UserCheck, Users, X } from 'lucide-react';
import { z } from 'zod';
import { createUserWithEmailAndPassword, EmailAuthProvider, GoogleAuthProvider, linkWithCredential, linkWithPopup, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type OAuthCredential } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { FirebaseError } from 'firebase/app';
import { deleteObject, getBytes, ref, uploadBytesResumable } from 'firebase/storage';
import { callBackend } from './backend';
import { auth, db, firebaseConfigured, storage } from './firebase';
import { publishDirectoryEntry } from './directory';
import NetworkDirectory, { networkViewFor } from './NetworkDirectory';
import GoalsEditor from './GoalsEditor';
import ConnectionRequests from './ConnectionRequests';
import CareerAssessment from './CareerAssessment';
import LearningPlan from './LearningPlan';
import StudentProgress from './StudentProgress';
import MockTestsOffers from './MockTestsOffers';
import ResponsiveHeroBanner, { GrowthOverview } from './ResponsiveHeroBanner';
import { GradientWave } from './GradientWave';
import { extractResumeText } from './resumeText';
import SiteNavbar from './SiteNavbar';
import { BrandingProvider, BrandingSettings, BrandSymbol } from './Branding';
import ProviderKeyManager from './ProviderKeyManager';

type Role='student'|'college'|'company'|'admin';
type WorkspaceRole='student'|'college'|'company';
type User={name:string;email:string;role:Role;org:string;verified:boolean;offers?:string;photoURL?:string;provider?:string;workspaceReady?:boolean;workspaceRole?:WorkspaceRole;uid?:string};
type SavedResume={id:string;name:string;text:string;storagePath?:string;uploadedAt:string};
type Opportunity={id:string;title:string;company:string;organizationType?:'College'|'Company';type:string;location:string;skills:string;deadline:string;description:string;ownerEmail?:string;status?:'draft'|'published'};
type DemoApplication={id:string;opportunityId:string;title:string;company:string;companyEmail:string;studentName:string;studentEmail:string;phone:string;education:string;resumeLink:string;note:string;status:'Submitted'|'Reviewing'|'Exam invited'|'Offer'|'Rejected';createdAt:string};
export type AppData={user:User|null;opportunities:Opportunity[];applications:string[];resumeName:string;resumeText:string;resumes:SavedResume[];skills:string[];results:number[];goals:string[]};
const KEY='skillbridge-demo-v1';
const ACCOUNT_KEY='skillbridge-demo-account-v1';
const DEMO_APPLICATIONS_KEY='skillbridge-demo-applications-v1';
const DEMO_OPPORTUNITIES_KEY='skillbridge-demo-opportunities-v1';
const PLATFORM_ADMIN_EMAILS=new Set(['shfoundationsltd@gmail.com','johnseyd52@gmail.com']);
function isPlatformAdminEmail(email?:string|null){return Boolean(email&&PLATFORM_ADMIN_EMAILS.has(email.trim().toLowerCase()))}
function hasPlatformAdminAccess(account:{email?:string|null}|null|undefined){return isPlatformAdminEmail(account?.email)}
function readDemoApplications():DemoApplication[]{try{return JSON.parse(localStorage.getItem(DEMO_APPLICATIONS_KEY)||'[]') as DemoApplication[]}catch{return []}}
function writeDemoApplications(applications:DemoApplication[]){localStorage.setItem(DEMO_APPLICATIONS_KEY,JSON.stringify(applications))}
const initial:AppData={user:null,opportunities:[{id:'op-1',title:'Frontend Engineering Intern',company:'Northstar Labs',organizationType:'Company',type:'Full-time internship',location:'Remote',skills:'React, TypeScript, CSS',deadline:'2026-12-15',description:'Build accessible product experiences with a small engineering team.'},{id:'op-2',title:'Data Analytics Intern',company:'Fieldnote',organizationType:'Company',type:'Part-time internship',location:'Hybrid · Bengaluru',skills:'SQL, Python, Data visualization',deadline:'2026-11-30',description:'Help turn product and operations data into clear decisions.'},{id:'op-3',title:'Graduate Software Engineer',company:'Cedar Systems',organizationType:'Company',type:'Entry-level placement',location:'On-site · Pune',skills:'JavaScript, APIs, Git',deadline:'2027-01-10',description:'Join a collaborative team building tools for modern businesses.'}],applications:[],resumeName:'',resumeText:'',resumes:[],skills:[],results:[],goals:[]};
function read():AppData{try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');const shared=JSON.parse(localStorage.getItem(DEMO_OPPORTUNITIES_KEY)||'null');return {...initial,...saved,opportunities:Array.isArray(shared)?shared:(saved.opportunities||initial.opportunities)}}catch{return initial}}
type DemoAccount={user:User;passwordHash:string};
function readDemoAccounts():DemoAccount[]{try{return JSON.parse(localStorage.getItem('skillbridge-demo-accounts-v1')||'[]') as DemoAccount[]}catch{return []}}
async function hashDemoPassword(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`skillbridge-demo:${value}`));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
async function saveDemoAccount(user:User,password:string){const accounts=readDemoAccounts();const passwordHash=await hashDemoPassword(password);const found=accounts.findIndex(a=>a.user.email.toLowerCase()===user.email.toLowerCase());const entry={user,passwordHash};if(found>=0)accounts[found]=entry;else accounts.push(entry);localStorage.setItem('skillbridge-demo-accounts-v1',JSON.stringify(accounts))}
function saveDemoProfile(user:User){const accounts=readDemoAccounts();const found=accounts.findIndex(a=>a.user.email.toLowerCase()===user.email.toLowerCase());if(found>=0){accounts[found]={...accounts[found],user};localStorage.setItem('skillbridge-demo-accounts-v1',JSON.stringify(accounts))}}
function userDataKey(email:string){return `skillbridge-demo-user-${email.trim().toLowerCase()}`}
function readUserData(email:string):AppData{const shared=read().opportunities;try{const raw=localStorage.getItem(userDataKey(email));if(raw)return {...initial,...JSON.parse(raw),opportunities:shared,user:null}}catch{}const old=read();return old.user?.email.toLowerCase()===email.toLowerCase()?{...old,opportunities:shared}:{...initial,opportunities:shared}}
function savedResumes(data:Pick<AppData,'resumes'|'resumeName'|'resumeText'>):SavedResume[]{if(Array.isArray(data.resumes)&&data.resumes.length)return data.resumes;if(data.resumeName||data.resumeText)return [{id:'legacy-resume',name:data.resumeName||'Resume',text:data.resumeText||'',uploadedAt:''}];return []}
function readAccount():User|null{try{const raw=localStorage.getItem(ACCOUNT_KEY);return raw?JSON.parse(raw) as User:null}catch{return null}}
// A workspace counts as finished once the user launched one in the setup screen.
// The org check keeps accounts created before workspaceReady existed from being
// sent back through setup on every sign-in.
function hasCompletedWorkspace(u?:User|null){if(!u)return false;if(u.workspaceReady)return true;if(u.role==='admin')return true;return typeof u.org==='string'&&u.org.length>0&&u.org!=='Not provided'}
// Creates the default profile for an account that has none yet. The transaction only
// creates the document while it is missing, so it can never overwrite a workspace that
// was already picked during setup.
async function createDefaultProfile(firestore:Firestore,uid:string,draft:User):Promise<User>{
 return runTransaction(firestore,async tx=>{
  const ref=doc(firestore,'users',uid);
  const snap=await tx.get(ref);
  if(snap.exists())return snap.data() as User;
  tx.set(ref,{name:draft.name,email:draft.email,role:draft.role,org:draft.org,verified:draft.verified,createdAt:serverTimestamp()});
  return draft;
 }).catch(e=>{console.warn('Auto-create user doc warning:',e);return draft});
}

export default function App(){
 const [data,setData]=useState<AppData>(()=>firebaseConfigured?{...initial,opportunities:read().opportunities}:read());
 const [toast,setToast]=useState('');
 const [authReady,setAuthReady]=useState(!firebaseConfigured);
 const [isServerAdmin,setIsServerAdmin]=useState(false);
 useEffect(()=>{document.documentElement.classList.add('page-reload-active');const timer=window.setTimeout(()=>document.documentElement.classList.remove('page-reload-active'),1300);return()=>{window.clearTimeout(timer);document.documentElement.classList.remove('page-reload-active')}},[]);
 useEffect(()=>{
  if(!auth||!db)return;
  const firebaseAuth=auth;const firestore=db;
  return onAuthStateChanged(firebaseAuth,async(account)=>{
   if(!account){setIsServerAdmin(false);setData(current=>current.user?.role==='admin'?current:{...initial,user:null});setAuthReady(true);return}
   setIsServerAdmin(hasPlatformAdminAccess(account));setAuthReady(false);
   try{
    const [profileSnapshot,dataSnapshot]=await Promise.all([
     getDoc(doc(firestore,'users',account.uid)),getDoc(doc(firestore,'userData',account.uid)),
    ]);
    let profile:User|null=null;
    const draft:User={
     name:account.displayName||account.email?.split('@')[0]||'Student',
     email:account.email||'',
     role:'student',
     org:'Not provided',
     verified:true,
     photoURL:account.photoURL||undefined,
     provider:account.providerData[0]?.providerId||'google.com'
    };
    if(profileSnapshot.exists()){
     profile=profileSnapshot.data() as User;
     if(profile.role==='college'||profile.role==='company')profile.verified=true;
     if(profile.role==='college'||profile.role==='company')profile.verified=true;
     if(account.photoURL&&!profile.photoURL){profile.photoURL=account.photoURL}
    }else{
     const createdAt=account.metadata?.creationTime?Date.parse(account.metadata.creationTime):0;
     const brandNew=createdAt>0&&Date.now()-createdAt<60_000;
     const userRef=doc(firestore,'users',account.uid);
     if(brandNew){
      // The sign-in screen is publishing this profile right now with the workspace
      // the user picked, so give it a moment before falling back to a default entry.
      await new Promise(r=>setTimeout(r,1200));
      const fresh=await getDoc(userRef);
      if(fresh.exists()){
       profile=fresh.data() as User;
      }else{
       profile=await createDefaultProfile(firestore,account.uid,draft);
      }
     }else{
      // Safety net for accounts without a profile doc. The transaction only creates the
      // doc while it is still missing, so it can never overwrite a workspace that was
      // already picked during setup.
      profile=await createDefaultProfile(firestore,account.uid,draft);
     }
    }
    const saved=dataSnapshot.exists()?dataSnapshot.data():{};
    setData(current=>{
     if(!profile){
      // No stored profile yet: keep the one the sign-in screen just built.
      return current.user?{...current,...saved,user:current.user}:{...initial,...saved,user:null};
     }
     // The snapshot can land after the user already confirmed a workspace. Keep the
     // locally confirmed workspace instead of reverting to the older snapshot.
     const local=current.user;
     const resolved=local&&local.workspaceReady&&!profile.workspaceReady
      ?{...profile,name:local.name,role:local.role,org:local.org,verified:local.verified,workspaceReady:true}
      :profile;
     return {...initial,...saved,user:resolved};
    });
   }catch(error){
    console.warn('Could not load Firebase profile:', error);
    const fallbackUser:User={
     name:account.displayName||account.email?.split('@')[0]||'Student',
     email:account.email||'',
     role:'student',
     org:'Not provided',
     verified:true,
     photoURL:account.photoURL||undefined,
     provider:account.providerData[0]?.providerId||'google.com'
    };
    setData({...initial,user:fallbackUser});
   }
   finally{setAuthReady(true)}
  });
 },[]);
 useEffect(()=>{
  localStorage.setItem(DEMO_OPPORTUNITIES_KEY,JSON.stringify(data.opportunities));if(!firebaseConfigured){localStorage.setItem(KEY,JSON.stringify(data));if(data.user){localStorage.setItem(userDataKey(data.user.email),JSON.stringify({...data,user:null}));saveDemoProfile(data.user)}return}
  if(!authReady||!auth?.currentUser||!db||data.user?.role==='admin'||isServerAdmin||!data.user)return;
  const uid=auth.currentUser.uid;
  void setDoc(doc(db,'userData',uid),{
   applications:data.applications,resumeName:data.resumeName,resumeText:data.resumeText,resumes:data.resumes||[],skills:data.skills,results:data.results,goals:data.goals,updatedAt:serverTimestamp(),
  },{merge:true}).catch(error=>setToast(error instanceof Error?error.message:'Could not save your profile to Firestore.'));
 },[data,authReady,isServerAdmin]);
 // Publish this member's entry so the other workspaces can discover them.
 useEffect(()=>{
  if(!firebaseConfigured||!authReady||!auth?.currentUser||!db||!data.user)return;
  if(data.user.role==='admin'||isServerAdmin)return;
  void publishDirectoryEntry(db,auth.currentUser.uid,data.user,data).catch(()=>{});
 },[data,authReady,firebaseConfigured,isServerAdmin]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t)}},[toast]);
 const flash=(s:string)=>setToast(s);
 const login=(u:User)=>{if(!firebaseConfigured)saveDemoProfile(u);setData(d=>({...readUserData(u.email),opportunities:d.opportunities,user:u}))};
 const logout=()=>{if(auth)void signOut(auth);if(!firebaseConfigured&&data.user){saveDemoProfile(data.user);localStorage.setItem(ACCOUNT_KEY,JSON.stringify(data.user));}setData(d=>({...d,user:null}))};
 return <BrandingProvider><Routes><Route path="/" element={<Landing/>}/><Route path="/about" element={<AboutPage/>}/><Route path="/our-story" element={<OurStoryPage/>}/><Route path="/blog" element={<BlogPage/>}/><Route path="/students" element={<StudentsPage/>}/><Route path="/colleges" element={<CollegesPage/>}/><Route path="/employers" element={<EmployersPage/>}/><Route path="/contact" element={<ContactPage/>}/><Route path="/opportunities" element={<Marketplace data={data} setData={setData} flash={flash}/>}/><Route path="/login" element={<Auth mode="login" login={login} flash={flash} authReady={authReady} currentUser={data.user}/>}/><Route path="/register" element={<Auth mode="register" login={login} flash={flash} authReady={authReady} currentUser={data.user}/>}/><Route path="/select-role" element={!authReady?<BootScreen/>:!data.user?<Navigate to="/login" replace/>:isServerAdmin||data.user.role==='admin'||data.user.workspaceReady?<Navigate to="/app" replace/>:<RoleSelection data={data} setData={setData} flash={flash}/>}/><Route path="/app/*" element={!authReady?<BootScreen/>:data.user?<Dashboard data={data} setData={setData} logout={logout} flash={flash} serverAdminAccess={isServerAdmin}/>:<Navigate to="/login" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>{toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}</BrandingProvider>
}

function Logo(){return <Link to="/" className="brand"><span className="brand-icon"><BrandSymbol size={20}/></span><span>skill<span className="brand-light">bridge</span></span></Link>}
function SiteFooter(){return <footer className="site-footer" id="contact"><div className="container footer-grid"><div className="footer-brand"><Logo/><p>Bridge what you’re learning with the opportunities you’re ready for.</p><span className="footer-note">Your skills. Your progress. Your next step.</span></div><div className="footer-column"><h3>Explore</h3><Link to="/about">About us</Link><Link to="/our-story">Our story</Link><Link to="/blog">Blog</Link><Link to="/opportunities">Explore opportunities</Link></div><div className="footer-column"><h3>For the community</h3><Link to="/students">Students</Link><Link to="/colleges">Colleges</Link><Link to="/employers">Employers</Link></div><div className="footer-column footer-contact"><h3>Contact us</h3><p>Students: contact your college career services team for account support.</p><p>Employers: use the contact details on each opportunity listing.</p><Link to="/opportunities" className="footer-contact-link">Browse opportunities <ArrowRight size={14}/></Link></div></div><div className="container footer-bottom"><span>© 2026 SkillBridge</span><div><Link to="/login">Log in</Link><Link to="/register">Create an account</Link></div></div></footer>}
function BootScreen(){return <div className="boot-screen"><span className="boot-mark"><BrandSymbol size={20}/></span><p>Loading your workspace...</p></div>}
function Landing(){return <><main><ResponsiveHeroBanner/><GrowthOverview/><section className="section" id="how"><div className="container"><div className="section-head"><div className="eyebrow">A better way forward</div><h2>From what you know to<br/>what you can become.</h2><p>Build a clear picture of your strengths, close skill gaps, and find opportunities that fit.</p></div><div className="steps"><Feature n="01" icon={<FileText/>} title="Show what you know" text="Bring your resume and experience together in one profile you control."/><Feature n="02" icon={<Target/>} title="Find your next step" text="Use focused assessments to see where you’re strong and what to practice next."/><Feature n="03" icon={<BriefcaseBusiness/>} title="Connect with opportunity" text="Discover internships and early-career roles matched to your skills and goals."/></div></div></section><section className="section tinted" id="students"><div className="container feature-split"><div><div className="eyebrow">For students</div><h2>Make your progress<br/>visible.</h2><p>Keep your profile, learning goals, assessments, and applications in one place. You decide what to share.</p><ul className="check-list"><li><CheckCircle2/> Track skills and assessment results</li><li><CheckCircle2/> Get practical learning recommendations</li><li><CheckCircle2/> Apply directly to opportunities</li></ul><Link className="text-link" to="/register">Build your profile <ArrowRight size={16}/></Link></div><div className="feature-card"><div className="feature-card-head"><span className="icon-tile"><Award/></span><span className="subtle">PROFILE SNAPSHOT</span></div><h3>Your skills, clearly presented</h3><p>Combine experience and measured progress in a profile you can keep improving.</p><div className="snapshot-row"><span>JavaScript</span><b>Assessment complete</b></div><div className="snapshot-row"><span>React</span><b className="muted">Ready to practice</b></div><div className="snapshot-row"><span>SQL</span><b className="muted">In your learning plan</b></div></div></div></section><section className="section" id="institutions"><div className="container"><div className="section-head"><div className="eyebrow">Built for the whole bridge</div><h2>Shared progress.<br/>Clearer connections.</h2><p>Dedicated workspaces give colleges and employers the context they need while keeping student access at the center.</p></div><div className="steps"><Feature n="COLLEGES" icon={<GraduationCap/>} title="Support student growth" text="Review institution-linked student progress and recommend eligible students to opportunities."/><Feature n="EMPLOYERS" icon={<Building2/>} title="Reach prepared talent" text="Publish opportunities, review applicants, and manage your hiring pipeline."/><Feature n="TRUST" icon={<ShieldCheck/>} title="Trust, built in" text="Institutional access starts pending and stays locked until an authorized review."/></div></div></section><section className="cta"><GradientWave className="cta-gradient-wave" colors={["#38bdf8", "#ffffff", "#38bdf8", "#ffffff", "#38bdf8", "#ffffff"]} noiseSpeed={0.000035} deform={{ incline: 0.5, noiseAmp: 95, noiseFlow: 4 }}/><div className="container cta-inner"><div><div className="eyebrow light">Your next chapter starts here</div><h2>Ready to build your bridge?</h2><p>Start with a profile. Take the next step at your pace.</p></div><Link to="/register" className="button white">Get started <ArrowRight size={17}/></Link></div></section></main><SiteFooter/></>}
function Skill({label,value,color}:{label:string;value:number;color:string}){return <div className="skill-line"><div><span>{label}</span><b>{value}%</b></div><div className="bar"><i className={color} style={{width:`${value}%`}}/></div></div>}
function AboutPage(){return <div className="information-page"><SiteNavbar mode="page"/><main><section className="information-hero container"><div className="eyebrow">ABOUT SKILLBRIDGE</div><h1>Make your next step clear.</h1><p>SkillBridge helps students connect what they know, what they’re learning, and the opportunities they’re ready to pursue.</p><Link className="button" to="/register">Build your profile <ArrowRight size={16}/></Link></section><section className="section"><div className="container"><div className="section-head"><div className="eyebrow">HOW IT WORKS</div><h2>Progress you can put to work.</h2><p>Bring your skills, goals, and next opportunities together in one place.</p></div><div className="steps"><Feature n="01" icon={<FileText/>} title="Build your profile" text="Add your resume and experience, then review the skills in your profile."/><Feature n="02" icon={<Target/>} title="See your progress" text="Use practice assessments and learning goals to decide what to work on next."/><Feature n="03" icon={<BriefcaseBusiness/>} title="Explore opportunities" text="Browse internships and early-career roles and apply from your student account."/></div></div></section><section className="section tinted"><div className="container feature-split"><div><div className="eyebrow">FOR THE COMMUNITY</div><h2>One bridge, shared progress.</h2><p>Students control their profile. Colleges can support connected students, and employers can publish opportunities and review applicants.</p><Link className="text-link" to="/register">Choose a workspace <ArrowRight size={16}/></Link><div className="audience-links"><Link to="/students">For students <ArrowRight size={14}/></Link><Link to="/colleges">For colleges <ArrowRight size={14}/></Link><Link to="/employers">For employers <ArrowRight size={14}/></Link></div></div><div className="steps"><Feature n="STUDENTS" icon={<GraduationCap/>} title="Own your next step" text="Manage your profile, skills, learning goals, and applications."/><Feature n="PARTNERS" icon={<Building2/>} title="Support student growth" text="Colleges and employers use dedicated workspaces for their role."/></div></div></section></main><SiteFooter/></div>}
function OurStoryPage(){return <div className="information-page"><SiteNavbar mode="page"/><main><section className="information-hero container"><div className="eyebrow">OUR STORY</div><h1>Learning should lead somewhere.</h1><p>SkillBridge is built around a simple idea: help people connect the skills they are building with the next opportunity they want to reach.</p></section><section className="section"><div className="container"><div className="section-head"><div className="eyebrow">THE BRIDGE</div><h2>Make growth easier to see.</h2><p>A resume, confirmed skills, practice, and goals can tell a clearer story when they live together.</p></div><div className="steps"><Feature n="01" icon={<FileText/>} title="Start with your experience" text="Bring your background and skills into one profile you can keep improving."/><Feature n="02" icon={<Target/>} title="Keep learning with direction" text="Use practice and learning goals to see what to strengthen next."/><Feature n="03" icon={<BriefcaseBusiness/>} title="Move toward opportunity" text="Explore early-career roles and share your progress when you apply."/></div><div className="information-contact-action"><p>Ready to build your bridge?</p><Link className="button" to="/register">Get started <ArrowRight size={16}/></Link></div></div></section></main><SiteFooter/></div>}
function BlogPage(){return <div className="information-page"><SiteNavbar mode="page"/><main><section className="information-hero container"><div className="eyebrow">SKILLBRIDGE BLOG</div><h1>Ideas for your next step.</h1><p>Practical notes on showing your skills, learning with purpose, and finding opportunities.</p></section><section className="section"><div className="container"><div className="steps"><Feature n="PROFILE" icon={<FileText/>} title="Turn your resume into a skills story" text="Make projects, tools, and outcomes easy to find so someone can quickly understand what you can do."/><Feature n="LEARNING" icon={<Target/>} title="Choose a learning goal you can act on" text="Start with one skill you want to strengthen, practice it in a small project, and track what improves."/><Feature n="OPPORTUNITY" icon={<BriefcaseBusiness/>} title="Prepare for an early-career role" text="Match your experience to the role requirements and use practice questions to prepare specific examples."/></div></div></section></main><SiteFooter/></div>}
function StudentsPage(){return <AudiencePage eyebrow="FOR STUDENTS" title="Build skills. Show your progress. Find your next step." description="Keep your resume, skills, learning goals, assessments, and applications together in a workspace you control." features={[{icon:<FileText/>,title:'Create your profile',text:'Add your resume and experience, then review the skills in your profile.'},{icon:<Target/>,title:'Track real progress',text:'Set learning goals and practice with assessments tailored to your next step.'},{icon:<BriefcaseBusiness/>,title:'Explore opportunities',text:'Find internships and early-career roles, then apply from your account.'}]} cta="Create a student account"/>}
function CollegesPage(){return <AudiencePage eyebrow="FOR COLLEGES" title="Give students clearer paths forward." description="Support students who connect with your institution and help them discover the opportunities that fit their goals." features={[{icon:<Users/>,title:'Support connected students',text:'Review students who request a connection and the profile details they choose to share.'},{icon:<Award/>,title:'Spot skills and gaps',text:'Use student progress and skill insights to guide practical support.'},{icon:<BriefcaseBusiness/>,title:'Recommend next steps',text:'Help students find relevant opportunities and prepare for applications.'}]} cta="Create a college account"/>}
function EmployersPage(){return <AudiencePage eyebrow="FOR EMPLOYERS" title="Meet talent ready for the next opportunity." description="Share early-career roles and manage your hiring activity through a dedicated employer workspace." features={[{icon:<BriefcaseBusiness/>,title:'Publish opportunities',text:'Create internship and entry-level listings with clear requirements.'},{icon:<Users/>,title:'Review applicants',text:'Keep applications organized and review candidate information.'},{icon:<Target/>,title:'Manage your pipeline',text:'Track hiring progress and coordinate next steps from one workspace.'}]} cta="Create an employer account"/>}
function AudiencePage({eyebrow,title,description,features,cta}:{eyebrow:string;title:string;description:string;features:{icon:React.ReactNode;title:string;text:string}[];cta:string}){return <div className="information-page"><SiteNavbar mode="page"/><main><section className="information-hero container"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p><Link className="button" to="/register">{cta} <ArrowRight size={16}/></Link></section><section className="section"><div className="container"><div className="steps">{features.map((feature,index)=><Feature key={feature.title} n={`0${index+1}`} icon={feature.icon} title={feature.title} text={feature.text}/>)}</div></div></section></main><SiteFooter/></div>}
function ContactPage(){return <div className="information-page"><SiteNavbar mode="page"/><main><section className="information-hero container"><div className="eyebrow">CONTACT</div><h1>We’re here to help you find the right path.</h1><p>Choose the support channel that best matches your question.</p></section><section className="section"><div className="container"><div className="steps"><Feature n="STUDENTS" icon={<GraduationCap/>} title="Account and career support" text="For profile, account, or career guidance, contact your college’s career services team."/><Feature n="COLLEGES" icon={<Building2/>} title="College workspace" text="Create a college account to review your workspace and connect with students who request support."/><Feature n="EMPLOYERS" icon={<BriefcaseBusiness/>} title="Employer opportunities" text="Create a company account to publish opportunities and manage applications in your workspace."/></div><div className="information-contact-action"><p>Ready to get started?</p><Link className="button" to="/register">Create an account <ArrowRight size={16}/></Link></div></div></section></main><SiteFooter/></div>}
function Feature({n,icon,title,text}:{n:string;icon:React.ReactNode;title:string;text:string}){return <article className="step"><div className="step-top"><span className="step-icon">{icon}</span><span>{n}</span></div><h3>{title}</h3><p>{text}</p></article>}

const schema=z.object({name:z.string().min(2,'Enter your name'),email:z.string().email('Enter a valid email'),password:z.string().min(8,'Use at least 8 characters'),org:z.string().min(2,'Enter your institution or company')});
function firebaseMessage(error:unknown){const code=(error as {code?:string})?.code;const messages:Record<string,string>={'auth/email-already-in-use':'This email already has an account. Sign in with its existing method, then link the other method in Settings.','auth/credential-already-in-use':'This Google account belongs to a different SkillBridge account. Sign in to that account to use its saved profile.','auth/provider-already-linked':'This sign-in method is already linked.','auth/invalid-credential':'Email or password is incorrect. Check the password, or use Continue with Google if this account was created with Google.','auth/invalid-login-credentials':'Email or password is incorrect. Check the password, or use Continue with Google if this account was created with Google.','auth/wrong-password':'Email or password is incorrect.','auth/user-not-found':'No account found with this email. Click "Create an account" below to register.','auth/user-disabled':'This account is disabled. Contact the SkillBridge administrator.','auth/too-many-requests':'Too many sign-in attempts. Wait a little while, then try again.','auth/network-request-failed':'Could not reach Firebase. Check your internet connection and try again.','auth/invalid-api-key':'Firebase sign-in is misconfigured. Check the Firebase API key in the local environment settings.','auth/weak-password':'Use a stronger password.','auth/invalid-email':'Enter a valid email address.','auth/operation-not-allowed':'Email and password sign-in is currently unavailable.','permission-denied':'You do not have permission to do that. Please try again.'};return code?messages[code]||`Sign-in failed (${code.replace(/^auth\//,'')}). Check your email and password, then try again.`:'Something went wrong. Please try again.'}
function Auth({mode,login,flash,authReady,currentUser}:{mode:'login'|'register';login:(u:User)=>void;flash:(s:string)=>void;authReady:boolean;currentUser:User|null}){const nav=useNavigate();const handled=useRef(false);const [role,setRole]=useState<Role>('student');const [err,setErr]=useState('');const [email,setEmail]=useState('');const [pass,setPass]=useState('');const [showPassword,setShowPassword]=useState(false);const [pendingGoogle,setPendingGoogle]=useState<OAuthCredential|null>(null);
    // A restored session should never send the user back to the sign-in form:
    // continue straight into the workspace that was already set up.
    useEffect(()=>{
      if(handled.current||!authReady||!currentUser)return;
      handled.current=true;
      nav(hasCompletedWorkspace(currentUser)?'/app':'/select-role');
    },[authReady,currentUser,nav]);
    const doGoogle=async()=>{
    handled.current=true;
    if(!firebaseConfigured||!auth||!db){setErr('Google sign-in is not configured for this deployment yet. Please redeploy after adding the Firebase environment variables.');return}
    setErr('');
    try{
      const result=await signInWithPopup(auth,new GoogleAuthProvider());
      const profileRef=doc(db,'users',result.user.uid);
      let profile:User;
      let returning=false;
      try{
        const profileSnapshot=await getDoc(profileRef);
        returning=profileSnapshot.exists();
        if(returning){
          profile=profileSnapshot.data() as User;
          if(result.user.photoURL&&!profile.photoURL){profile.photoURL=result.user.photoURL}
          profile.provider='google.com';
        }else{
          const draft:User={
            name:(mode==='register'?document.querySelector<HTMLInputElement>('input[name="name"]')?.value:'')||result.user.displayName||result.user.email?.split('@')[0]||'Student',
            email:result.user.email||'',
            role:mode==='register'?role:'student',
            org:mode==='register'?(document.querySelector<HTMLInputElement>('input[name="org"]')?.value||'Not provided'):'Not provided',
            verified:true,
            photoURL:result.user.photoURL||undefined,
            provider:'google.com'
          };
          // Create the profile only while it is missing: role and verified are fixed at
          // creation time, so merging over an existing document is rejected by the
          // Firestore rules and would drop every other field as well.
          await runTransaction(db,async tx=>{
            const snap=await tx.get(profileRef);
            if(snap.exists())return;
            tx.set(profileRef,{name:draft.name,email:draft.email,role:draft.role,org:draft.org,verified:draft.verified,createdAt:serverTimestamp()});
          });
          const created=await getDoc(profileRef);
          profile=created.exists()?created.data() as User:draft;
          if(result.user.photoURL&&!profile.photoURL){profile.photoURL=result.user.photoURL}
        }
      }catch(fsErr){
        console.warn('Firestore read/write failed during Google sign in:', fsErr);
        profile={
          name:result.user.displayName||result.user.email?.split('@')[0]||'Student',
          email:result.user.email||'',
          role:'student',
          org:'Not provided',
          verified:true,
          photoURL:result.user.photoURL||undefined,
          provider:'google.com'
        };
      }
      if(returning&&hasCompletedWorkspace(profile)&&!profile.workspaceReady){
        // Backfill the flag for accounts that were created before setup was tracked.
        profile.workspaceReady=true;
        void setDoc(profileRef,{workspaceReady:true,updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});
      }
      login(profile);
      flash('Signed in with Google.');
      nav(hasPlatformAdminAccess(result.user)||(returning&&hasCompletedWorkspace(profile))?'/app':'/select-role');
    }catch(error){
      const code=(error as {code?:string})?.code;
      if(code==='auth/account-exists-with-different-credential'){
        setPendingGoogle(GoogleAuthProvider.credentialFromError(error as FirebaseError));
        setErr('This email already has a password account. Enter its password and choose Sign in to link Google to that same account.');
      }else setErr(firebaseMessage(error));
    }
  };const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    handled.current=true;
    e.preventDefault();
    setErr('');
    const f=new FormData(e.currentTarget);
    const obj={name:String(f.get('name')||''),email:String(f.get('email')||''),password:String(f.get('password')||''),org:String(f.get('org')||'')};
    if(import.meta.env.DEV&&obj.email.trim().toLowerCase()==='admin'&&obj.password==='1234admin'){if(auth?.currentUser)await signOut(auth).catch(()=>{});const demoAdmin:User={name:'SkillBridge Admin',email:'admin@skillbridge.local',role:'admin',org:'SkillBridge',verified:true,provider:'demo'};login(demoAdmin);flash('Signed in to the local admin demo workspace.');nav('/app');return}
    if(mode==='register'){
      const res=schema.safeParse(obj);
      if(!res.success){setErr(res.error.issues[0].message);return}
      const u:User={name:obj.name,email:obj.email,role,org:obj.org,verified:true,provider:'password'};
      if(firebaseConfigured&&auth&&db){
        try{
          const credential=await createUserWithEmailAndPassword(auth,obj.email,obj.password);
          try{
            // role and verified are fixed when the profile is created, so create the
            // document only while it is missing instead of merging over an existing one.
            const userRef=doc(db,'users',credential.user.uid);
            await runTransaction(db,async tx=>{
              const snap=await tx.get(userRef);
              if(snap.exists())return;
              tx.set(userRef,{name:u.name,email:u.email,role:u.role,org:u.org,verified:u.verified,createdAt:serverTimestamp()});
            });
          }catch(fsErr){
            console.warn('Firestore write warning on register:', fsErr);
          }
          login(u);
          flash('Account created successfully.');
          nav('/select-role');
        }catch(error){
          setErr(firebaseMessage(error));
        }
        return;
      }
      await saveDemoAccount(u,obj.password);
      login(u);
      flash('Account created. Welcome to SkillBridge.');
      nav('/select-role');
      return;
    }
    if(firebaseConfigured&&auth&&db){
      try{
        const credential=await signInWithEmailAndPassword(auth,obj.email,obj.password);
        if(pendingGoogle){
          await linkWithCredential(credential.user,pendingGoogle);
          setPendingGoogle(null);
          flash('Google is now linked to this account.');
        }
        let loaded:User;
        let returning=false;
        try{
          const profile=await getDoc(doc(db,'users',credential.user.uid));
          returning=profile.exists();
          if(returning){
            loaded=profile.data() as User;
          }else{
            loaded={
              name:credential.user.displayName||credential.user.email?.split('@')[0]||'User',
              email:credential.user.email||'',
              role:'student',
              org:'Not provided',
              verified:true,
              provider:'password'
            };
            // Create the profile only while it is missing: role and verified cannot be
            // changed after creation, so merging over an existing document is rejected.
            const userRef=doc(db,'users',credential.user.uid);
            await runTransaction(db,async tx=>{
              const snap=await tx.get(userRef);
              if(snap.exists())return;
              tx.set(userRef,{name:loaded.name,email:loaded.email,role:loaded.role,org:loaded.org,verified:loaded.verified,createdAt:serverTimestamp()});
            });
          }
        }catch(fsErr){
          console.warn('Firestore getDoc warning on login:', fsErr);
          loaded={
            name:credential.user.displayName||credential.user.email?.split('@')[0]||'User',
            email:credential.user.email||'',
            role:'student',
            org:'Not provided',
            verified:true,
            provider:'password'
          };
        }
        if(credential.user.photoURL&&!loaded.photoURL){loaded.photoURL=credential.user.photoURL}
        loaded.provider='password';
        if(returning&&hasCompletedWorkspace(loaded)&&!loaded.workspaceReady){
          // Backfill the flag for accounts that were created before setup was tracked.
          loaded.workspaceReady=true;
          void setDoc(doc(db,'users',credential.user.uid),{workspaceReady:true,updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});
        }
        login(loaded);
        flash('Signed in successfully.');
        nav(hasPlatformAdminAccess(credential.user)||(returning&&hasCompletedWorkspace(loaded))?'/app':'/select-role');
      }catch(error){
        setErr(firebaseMessage(error));
      }
      return;
    }
    const account=readDemoAccounts().find(a=>a.user.email.toLowerCase()===email.toLowerCase());
    const legacy=readAccount();
    const legacyMatch=legacy&&legacy.email.toLowerCase()===email.toLowerCase()?legacy:null;
    const existing=account?.user||legacyMatch;
    if(!existing||pass.length<1||(account&&await hashDemoPassword(pass)!==account.passwordHash)){
      setErr('Email or password is incorrect.');
      return;
    }    login(existing);
    nav(hasCompletedWorkspace(existing)?'/app':'/select-role');
      };return <div className="auth-page"><SiteNavbar mode={mode}/><div className="auth-card"><div className="auth-mark"><span className="brand-icon"><BrandSymbol/></span></div><div className="eyebrow centered">{mode==='register'?'YOUR NEXT STEP STARTS HERE':'WELCOME BACK'}</div><h1>{mode==='register'?'Create your account':'Sign in to SkillBridge'}</h1><p className="auth-description">{mode==='register'?'Choose your workspace and start building your bridge.':'Pick up where you left off.'}</p><div className="demo-alert"><BrandSymbol size={16}/><span><b>{firebaseConfigured?'Account active':'Demo mode'}</b> | {firebaseConfigured?'Your profile is ready to use.':'Accounts are stored in this browser only.'}</span></div>{mode==='register'&&<><label className="field-label">I’m joining as</label><div className="role-picker">{(['student','college','company'] as Role[]).map((r)=><button type="button" onClick={()=>setRole(r)} className={role===r?'selected':''} key={r}>{r==='student'?<GraduationCap/>:r==='college'?<Building2/>:<BriefcaseBusiness/>}<span>{r==='student'?'Student':r==='college'?'College admin':'Recruiter'}</span></button>)}</div></>}<form onSubmit={submit} className="auth-form">{mode==='register'&&<label>Full name<input name="name" placeholder="e.g. Aisha Sharma" required/></label>}<label>{import.meta.env.DEV&&mode==='login'?'Email or local username':'Email address'}<input name="email" type={import.meta.env.DEV&&mode==='login'?'text':'email'} placeholder={import.meta.env.DEV&&mode==='login'?'you@example.com or admin':'you@example.com'} required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<div className="password-field"><input name="password" type={showPassword?'text':'password'} placeholder="At least 8 characters" required value={pass} onChange={e=>setPass(e.target.value)}/><button type="button" className="password-visibility" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{mode==='register'&&<label>{role==='student'?'College name':role==='college'?'College name':'Company name'}<input name="org" placeholder={role==='company'?'e.g. Northstar Labs':'e.g. Lakeside University'} required/></label>}{err&&<p className="form-error">{err}</p>}<button className="button full">{mode==='register'?'Create account':'Sign in'} <ArrowRight size={16}/></button></form><button type="button" className="button secondary full admin-demo-login" onClick={()=>void doGoogle()}>Continue with Google</button>{mode==='login'&&<button type="button" className="button secondary full admin-demo-login" onClick={()=>{login({name:'SkillBridge Admin',email:'admin@skillbridge.demo',role:'admin',org:'SkillBridge',verified:true,provider:'demo'});flash('Signed in to the admin demo workspace.');nav('/app')}}>Continue as Admin demo <ArrowRight size={16}/></button>}<p className="auth-switch">{mode==='register'?'Already have an account?':'New to SkillBridge?'} <Link to={mode==='register'?'/login':'/register'}>{mode==='register'?'Sign in':'Create an account'}</Link></p><p className="tiny-note"><ShieldCheck size={13}/> {role!=='student'&&mode==='register'?'College and company accounts are active immediately. Students can request a connection from them.':firebaseConfigured?'Profile data is saved to your account.':'Your information stays in this browser in demo mode.'}</p></div><SiteFooter/></div>}

const roleSectionsMap:Record<'student'|'college'|'company',{icon:React.ReactNode;title:string;desc:string}[]>={
  student:[
    {icon:<LayoutDashboard size={18}/>,title:'Overview',desc:'Readiness score ring, recent assessments, and prioritized learning actions.'},
    {icon:<FileText size={18}/>,title:'Resume Analysis',desc:'Upload PDF/DOCX resumes and review your profile and extracted credentials.'},
    {icon:<Award size={18}/>,title:'My Skills',desc:'Confirm self-reported skills, add new tags, and track verified proficiencies.'},
    {icon:<BrandSymbol size={18}/>,title:'AI Resume Assessment',desc:'Generate a role-specific practice assessment from your resume and save the score to your profile.'},
    {icon:<Target size={18}/>,title:'Assessments & Tests',desc:'Deterministic skill assessments with immediate feedback and scoring history.'},
    {icon:<BriefcaseBusiness size={18}/>,title:'Opportunities',desc:'Browse curated internships, entry-level jobs, and filter by skill requirements.'},
    {icon:<Building2 size={18}/>,title:'Companies',desc:'Find employers on SkillBridge, their open roles and the teams they are hiring for.'},
    {icon:<GraduationCap size={18}/>,title:'Colleges',desc:'Connect with institutions offering placements, mentoring, research and industry projects.'},
    {icon:<FileText size={18}/>,title:'My Applications',desc:'Track all submitted job and internship applications and their progress.'},
    {icon:<Clock3 size={18}/>,title:'Exam Schedule',desc:'Check upcoming exam milestones, dates, and certification test windows.'},
    {icon:<BookOpen size={18}/>,title:'Learning Plan',desc:'Curated study suggestions and actionable steps to close skill gaps.'}
  ],
  college:[
    {icon:<LayoutDashboard size={18}/>,title:'Overview',desc:'Cohort health dashboard, engagement tracking, and university-wide metrics.'},
    {icon:<Users size={18}/>,title:'Students Directory',desc:'See the students registered under your institution, their skills, readiness score and what they are looking for.'},
    {icon:<Building2 size={18}/>,title:'Departments',desc:'Compare department performance benchmarks across Computer Science, Data, and Eng.'},
    {icon:<Target size={18}/>,title:'Performance Analytics',desc:'Track average assessment scores, pass rates, and readiness distributions.'},
    {icon:<Award size={18}/>,title:'Skill Gaps Analysis',desc:'Identify curriculum deficiencies compared to live market hiring requirements.'},
    {icon:<BrandSymbol size={18}/>,title:'Recommendations',desc:'Endorse and recommend standout students directly to corporate partners.'},
    {icon:<UserCheck size={18}/>,title:'Student Requests',desc:'Review and approve or decline students requesting a connection with your college.'},
    {icon:<CircleHelp size={18}/>,title:'Settings & Controls',desc:'Manage institutional credentials, linked Google account, and department admins.'}
  ],
  company:[
    {icon:<LayoutDashboard size={18}/>,title:'Overview',desc:'Active vacancies, total candidate applicants, and interview milestone funnel.'},
    {icon:<Building2 size={18}/>,title:'Company Profile',desc:'Establish company branding, logo, industry focus, and office locations.'},
    {icon:<BriefcaseBusiness size={18}/>,title:'Manage Opportunities',desc:'Draft, publish, and manage internship and early-career job openings.'},
    {icon:<Search size={18}/>,title:'Student Discovery',desc:'Search and filter the whole student pool by validated assessment scores, skills and career goals.'},
    {icon:<FileText size={18}/>,title:'Applications Inbox',desc:'Review inbound student applications, resumes, and assessment history.'},
    {icon:<BriefcaseBusiness size={18}/>,title:'Hiring Pipeline',desc:'Move candidates through stages: Applied → Screening → Interview → Offer.'},
    {icon:<UserCheck size={18}/>,title:'Student Requests',desc:'Review and approve or decline students requesting a connection with your company.'},
    {icon:<CircleHelp size={18}/>,title:'Settings & Linking',desc:'Manage recruiter account, notifications, and linked Google authentication.'}
  ]
};

function RoleSelection({data,setData,flash}:{data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;flash:(s:string)=>void}){
  const nav=useNavigate();
  const u=data.user!;
  const [selectedRole,setSelectedRole]=useState<'student'|'college'|'company'>(u.workspaceRole||(u.role==='college'?'college':u.role==='company'?'company':'student'));
  const [name,setName]=useState(u.name);
  const [org,setOrg]=useState(u.org==='Not provided'?'':u.org);
  const [offers,setOffers]=useState(u.offers||'');
  const [showSettings,setShowSettings]=useState(false);
  const [saving,setSaving]=useState(false);

  const sections=roleSectionsMap[selectedRole];

  const handleSaveProfile=async()=>{
    setSaving(true);
    const chosenName=name.trim()||u.name;
    const chosenOrg=org.trim()||u.org;
    const updated:User={...u,name:chosenName,org:chosenOrg,offers};
    setData(d=>({...d,user:updated}));
    if(firebaseConfigured&&auth?.currentUser&&db&&u.role!=='admin'){
      try{
        await setDoc(doc(db,'users',auth.currentUser.uid),{name:chosenName,org:chosenOrg,updatedAt:serverTimestamp()},{merge:true});
        flash('Google profile settings saved.');
      }catch(e){
        flash('Could not save your changes.');
      }
    }else{
      flash('Profile settings updated.');
    }
    setSaving(false);
    setShowSettings(false);
  };

  const handleProceed=async()=>{
    const chosenName=name.trim()||u.name;
    const chosenOrg=org.trim()||(selectedRole==='company'?'Your Company':'Your College');
      const updatedUser:User={
      ...u,
      name:chosenName,
      org:chosenOrg,
      offers,
      workspaceRole:selectedRole,
      workspaceReady:true
    };
    setData(d=>({...d,user:updatedUser}));
    if(firebaseConfigured&&auth?.currentUser&&db&&u.role!=='admin'){
      try{
        await setDoc(doc(db,'users',auth.currentUser.uid),{
          name:chosenName,
          org:chosenOrg,
          offers,
          workspaceRole:selectedRole,
          workspaceReady:true,
          updatedAt:serverTimestamp()
        },{merge:true});
      }catch(e){
        console.error('Error saving role:',e);
      }
    }
    flash(`Welcome to your ${selectedRole==='student'?'Student':selectedRole==='college'?'College':'Recruiter'} workspace!`);
    nav('/app');
  };

  const content=(
    <div className="role-selection-inner">
      <header className="role-top-nav">
        <Logo/>
      </header>

      {/* Google Profile Settings and Mail Card */}
      <div className="google-profile-card">
        <div className="google-profile-header">
          <div className="google-user-info">
            <div className="google-avatar-wrapper">
              {u.photoURL?(
                <img src={u.photoURL} alt={u.name} className="google-avatar-img"/>
              ):(
                <div className="google-avatar-fallback">
                  {u.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}
                </div>
              )}
              <span className="google-badge-pill" title="Google Account Connected">
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </span>
            </div>
            <div className="google-meta-col">
              <div className="google-meta-name">
                {u.name}
              </div>
              <div className="google-mail-row">
                <span className="mail-chip" title="Account Email">
                  <Mail size={13}/> {u.email}
                </span>
                <span className="verified-chip">
                  <Check size={12}/> Verified
                </span>
                <span className="provider-chip">
                  {u.provider==='google.com'||u.photoURL?'Google Account':'SkillBridge Profile'}
                </span>
              </div>
            </div>
          </div>
          <div>
            <button type="button" className="button secondary small" onClick={()=>setShowSettings(!showSettings)}>
              <SettingsIcon size={14}/> {showSettings?'Close Settings':'Google Profile Settings'}
            </button>
          </div>
        </div>

        {showSettings&&(
          <div className="google-profile-settings">
            <div className="setting-field">
              <label><UserCheck size={13}/> Display Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/>
            </div>
            <div className="setting-field">
              <label><Building2 size={13}/> Affiliated Organization / College</label>
              <input value={org} onChange={e=>setOrg(e.target.value)} placeholder="e.g. Stanford University or Google Labs"/>
            </div>
            <div className="setting-field">
              <button type="button" className="button small" onClick={handleSaveProfile} disabled={saving}>
                {saving?'Saving...':'Save Profile Changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3 Interactive Boxes: Student, College, Recruiter */}
      <div className="role-hero-title">
        <div className="eyebrow"><BrandSymbol size={14}/> WORKSPACE SETUP</div>
        <h1>Are you a Student, College, or Recruiter?</h1>
        <p>Select your role below to inspect all included sections and enter your customized SkillBridge workspace.</p>
      </div>

      <div className="role-boxes">
        {/* Box 1: Student */}
        <div className={`role-box-card ${selectedRole==='student'?'active':''}`} onClick={()=>setSelectedRole('student')}>
          <div className="role-card-top">
            <div className="role-card-icon icon-student">
              <GraduationCap size={28}/>
            </div>
            <div className="role-check-bubble">
              <Check size={16}/>
            </div>
          </div>
          <span className="role-card-badge">FOR LEARNERS</span>
          <h3>Student</h3>
          <p className="role-card-desc">Showcase verified skills, take practice assessments, build readiness score, and apply to top internships and early-career jobs.</p>
          <div className="role-card-tags">
            <span>Resume Analysis</span>
            <span>Skill Badges</span>
            <span>Opportunities</span>
          </div>
        </div>

        {/* Box 2: College */}
        <div className={`role-box-card ${selectedRole==='college'?'active':''}`} onClick={()=>setSelectedRole('college')}>
          <div className="role-card-top">
            <div className="role-card-icon icon-college">
              <Building2 size={28}/>
            </div>
            <div className="role-check-bubble">
              <Check size={16}/>
            </div>
          </div>
          <span className="role-card-badge">FOR INSTITUTIONS</span>
          <h3>College</h3>
          <p className="role-card-desc">Track cohort-wide skill mastery, analyze industry gaps, support student growth, and endorse prepared talent to employers.</p>
          <div className="role-card-tags">
            <span>Student Roster</span>
            <span>Gap Analysis</span>
            <span>Endorsements</span>
          </div>
        </div>

        {/* Box 3: Recruiter */}
        <div className={`role-box-card ${selectedRole==='company'?'active':''}`} onClick={()=>setSelectedRole('company')}>
          <div className="role-card-top">
            <div className="role-card-icon icon-recruiter">
              <BriefcaseBusiness size={28}/>
            </div>
            <div className="role-check-bubble">
              <Check size={16}/>
            </div>
          </div>
          <span className="role-card-badge">FOR EMPLOYERS</span>
          <h3>Recruiter</h3>
          <p className="role-card-desc">Post hiring opportunities, discover pre-assessed campus talent, and manage applicants in your hiring pipeline.</p>
          <div className="role-card-tags">
            <span>Post Vacancies</span>
            <span>Talent Search</span>
            <span>Hiring Pipeline</span>
          </div>
        </div>
      </div>

      {/* Role Details and Sections Panel Below */}
      <div className="role-details-card">
        <div className="role-details-header">
          <div>
            <div className="role-details-title-row">
              <span className={`role-card-icon ${selectedRole==='student'?'icon-student':selectedRole==='college'?'icon-college':'icon-recruiter'}`} style={{width:'42px',height:'42px',borderRadius:'11px'}}>
                {selectedRole==='student'?<GraduationCap size={22}/>:selectedRole==='college'?<Building2 size={22}/>:<BriefcaseBusiness size={22}/>}
              </span>
              <h2>{selectedRole==='student'?'Student Workspace Details':selectedRole==='college'?'College Institution Details':'Recruiter & Employer Details'}</h2>
              <span className="role-details-badge">SELECTED ROLE</span>
            </div>
            <p className="role-details-desc">
              {selectedRole==='student'
                ?'Designed for university students and early-career builders. Focuses on bridging coursework with industry-ready skills, AI practice evaluations, and transparent job applications.'
                :selectedRole==='college'
                ?'Built for academic departments, career service centers, and college deans to monitor student cohort readiness and bridge academic curricula with real employer expectations.'
                :'Tailored for campus recruiters, founders, and hiring teams seeking verified candidate profiles with measurable skill benchmarks and zero fluff.'
              }
            </p>
          </div>
        </div>

        <div className="role-sections-subtitle">
          <Compass size={17} style={{color:'#6d28d9'}}/>
          <span>Included Sections in this Workspace ({sections.length} sections)</span>
        </div>

        <div className="sections-grid">
          {sections.map((sec,idx)=>(
            <div key={idx} className="section-tile">
              <span className="section-tile-icon">{sec.icon}</span>
              <div className="section-tile-content">
                <b>{sec.title}</b>
                <p>{sec.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="role-action-bar">
          <div className="role-org-input-group">
            <label>
              {selectedRole==='student'?'College / University Name':selectedRole==='college'?'College / University Name':'Company Name'}
            </label>
            <input
              value={org}
              onChange={e=>setOrg(e.target.value)}
              placeholder={selectedRole==='company'?'e.g. Northstar Labs':'e.g. Lakeside University'}
            />
            {selectedRole!=='student'&&<>
              <label>{selectedRole==='company'?'Roles and internships you offer':'Programs and student support you offer'}</label>
              <textarea value={offers} onChange={e=>setOffers(e.target.value)} rows={3} maxLength={1200} placeholder="Describe programs, placements, internships, mentorship, or other opportunities." />
            </>}
          </div>
          <button className="button" onClick={handleProceed} style={{padding:'13px 24px',fontSize:'13px'}}>
            Launch {selectedRole==='student'?'Student':selectedRole==='college'?'College':'Recruiter'} Workspace <ArrowRight size={16}/>
          </button>
        </div>
      </div>
    </div>
  );

  return <div className="role-selection-page">{content}</div>;
}

const navByRole:Record<'student'|'college'|'company',string[]>={student:['Overview','My Profile','Resume Analysis','AI Resume Assessment','Mock Tests & Offers','My Skills','Assessments','Exam Schedule','Performance','Learning Plan','Opportunities','Companies','Colleges','My Applications','Settings'],college:['Overview','Students','Student Requests','Companies','Departments','Performance Analytics','Skill Gaps','Recommendations','Settings'],company:['Overview','Company Profile','Opportunities','Student Discovery','Student Requests','Colleges','Applications','Hiring Pipeline','Settings']};
function Dashboard({data,setData,logout,flash,serverAdminAccess}:{data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;logout:()=>void;flash:(s:string)=>void;serverAdminAccess:boolean}){const pageStorageKey=`skillbridge-dashboard-page:${data.user?.uid||data.user?.email?.toLowerCase()||'guest'}`;const [page,setPage]=useState(()=>{try{const saved=localStorage.getItem(pageStorageKey);return saved==='Branding'?'Overview':saved||'Overview'}catch{return 'Overview'}});const [mobile,setMobile]=useState(false);const [viewRole,setViewRole]=useState<'student'|'college'|'company'>('student');const [roleMenuOpen,setRoleMenuOpen]=useState(false);const [avatarImageFailed,setAvatarImageFailed]=useState(false);const u=data.user!;const isAdmin=u.role==='admin'||serverAdminAccess;const role:WorkspaceRole=isAdmin?viewRole:(u.workspaceRole||(u.role==='admin'?'student':u.role));const viewUser={...u,role,verified:true};const dashboardData=isAdmin&&u.role!=='admin'?{...data,user:{...u,role:'admin' as const}}:data;const title=role==='student'?'Student workspace':role==='college'?'College workspace':role==='company'?'Recruiter workspace':'Admin workspace';
useEffect(()=>{try{localStorage.setItem(pageStorageKey,page)}catch{}},[page,pageStorageKey]);
useEffect(()=>{const validPages=dashboardNav(role,isAdmin);if(!validPages.includes(page))setPage('Overview')},[role,isAdmin,page]);
useEffect(()=>{const handleResize=()=>{if(window.innerWidth>700)setMobile(false)};window.addEventListener('resize',handleResize);return()=>window.removeEventListener('resize',handleResize)},[]);useEffect(()=>{if(!mobile)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previousOverflow}},[mobile]);const dashboardNav=(role:'student'|'college'|'company',admin:boolean)=>admin?[...navByRole[role],'AI Configuration']:navByRole[role];
return <div className="workspace"><aside className={`sidebar ${mobile?'open':''}`}><div className="side-brand"><Logo/><button className="icon-button close-menu" onClick={()=>setMobile(false)}><X/></button></div><div className="workspace-label">{isAdmin?(u.role==='admin'?'ADMIN DEMO · ':'ADMIN ACCESS · ')+title.toUpperCase():title.toUpperCase()}</div><div className="user-mini"><div className="avatar">{u.photoURL&&!avatarImageFailed?<img src={u.photoURL} alt="" onError={()=>setAvatarImageFailed(true)} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>:u.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div><div><b>{u.name}</b><small>{u.role==='admin'?'Admin demo account':serverAdminAccess?'Authorized admin account':role==='student'?u.org:'Active · '+u.org}</small></div></div><nav className="side-nav">{dashboardNav(role,isAdmin).map(n=><button onClick={()=>{setPage(n);setMobile(false)}} className={page===n?'active':''} key={n}>{sideIcon(n)}{n}</button>)}</nav><div className="side-bottom"><div className="demo-side"><BrandSymbol size={15}/><span>{serverAdminAccess?'ADMIN ACCESS':firebaseConfigured&&u.role!=='admin'?'CLOUD ACCOUNT':'DEMO MODE'}<br/><small>{serverAdminAccess?'Verified administrator':firebaseConfigured&&u.role!=='admin'?'Cloud profile active':'Browser demo data'}</small></span></div><button className="logout" onClick={logout}><LogOut size={17}/> Sign out</button></div></aside>{mobile&&<button className="scrim" onClick={()=>setMobile(false)} aria-label="Close menu"/>}<main className="main-panel"><header className="dash-header"><div className="mobile-header-brand"><Logo/></div><button className="icon-button menu-button" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <b>{page}</b></div><div className="header-right">{isAdmin&&<div className="role-switcher"><button type="button" className="account-switch" aria-label="Switch account view" aria-haspopup="listbox" aria-expanded={roleMenuOpen} onClick={()=>setRoleMenuOpen(open=>!open)}>{viewRole==='student'?'Student view':viewRole==='college'?'College view':'Recruiter view'}<ChevronDown size={14}/></button>{roleMenuOpen&&<div className="role-switch-menu" role="listbox" aria-label="Workspace views">{([{value:'student',label:'Student view'},{value:'college',label:'College view'},{value:'company',label:'Recruiter view'}] as const).map(option=><button type="button" role="option" aria-selected={viewRole===option.value} className={viewRole===option.value?'selected':''} key={option.value} onClick={()=>{setViewRole(option.value);setPage('Overview');setRoleMenuOpen(false)}}>{option.label}{viewRole===option.value&&<Check size={14}/>}</button>)}</div>}</div>}<span className="demo-pill"><i/> {serverAdminAccess?'ADMIN ACCESS':firebaseConfigured&&u.role!=='admin'?'ACCOUNT ACTIVE':'DEMO MODE'}</span><div className="avatar small-avatar">{u.photoURL&&!avatarImageFailed?<img src={u.photoURL} alt="" onError={()=>setAvatarImageFailed(true)} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>:u.name[0].toUpperCase()}</div></div></header><div className="dash-content">{isAdmin&&<div className="demo-alert"><ShieldCheck size={16}/><span><b>Admin preview</b> · Switch workspaces here to preview each role. Changes in this preview are not saved to your account.</span></div>}<div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'})}</div><h1>{page==='Overview'?`Welcome, ${u.name.split(' ')[0]}`:page}</h1><p>{role==='student'?'A clear view of your skills, progress, and next opportunities.':role==='college'?'Support student development with institution-linked insights.':role==='company'?'Manage opportunities and connect with early-career talent.':'Manage SkillBridge.'}</p></div>{role==='student'&&<Link to="/opportunities" state={{workspaceRole:role}} className="button small">Explore opportunities <ArrowRight size={15}/></Link>}</div><DashboardContent page={page} data={dashboardData} setData={setData} user={viewUser} flash={flash} navigate={setPage} adminAccess={isAdmin}/></div></main></div>}
function sideIcon(s:string){const map:Record<string,React.ReactNode>={Overview:<LayoutDashboard/>, 'My Profile':<Users/>, 'Resume Analysis':<FileText/>, 'AI Resume Assessment':<BrandSymbol/>, 'Mock Tests & Offers':<FileCheck2/>, 'My Skills':<Award/>, Assessments:<Target/>, 'Exam Schedule':<Clock3/>,Performance:<Target/>, 'Learning Plan':<BookOpen/>,Opportunities:<BriefcaseBusiness/>, 'My Applications':<FileText/>,Students:<Users/>, 'Student Requests':<UserCheck/>,Departments:<Building2/>, 'Performance Analytics':<Target/>, 'Skill Gaps':<Award/>,Recommendations:<BrandSymbol/>, 'Company Profile':<Building2/>, 'Student Discovery':<Search/>,Colleges:<GraduationCap/>,Companies:<Building2/>,Applications:<FileText/>, 'Hiring Pipeline':<BriefcaseBusiness/>,Settings:<CircleHelp/>, 'AI Configuration':<ShieldCheck/>,Branding:<BrandSymbol/>};return map[s]||<LayoutDashboard/>}
function AccountConnections({email}:{email:string}){const [password,setPassword]=useState('');const [message,setMessage]=useState('');const account=auth?.currentUser;const providers=account?.providerData.map(item=>item.providerId)||[];const googleLinked=providers.includes('google.com');const passwordLinked=providers.includes('password');const addGoogle=async()=>{if(!account){setMessage('Sign in to your account to link providers.');return}try{await linkWithPopup(account,new GoogleAuthProvider());setMessage('Google is linked. You can now use either sign-in method.')}catch(error){setMessage(firebaseMessage(error))}};const addPassword=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!account||!account.email){setMessage('Sign in with Google first to add a password.');return}try{await linkWithCredential(account,EmailAuthProvider.credential(account.email,password));setPassword('');setMessage('Password sign-in is now linked to this same account.')}catch(error){setMessage(firebaseMessage(error))}};if(!firebaseConfigured||email==='admin@skillbridge.demo')return <div className="panel"><h3>Sign-in methods</h3><p className="body-copy">Link another sign-in method to keep using the same account.</p></div>;return <div className="panel account-connections"><h3>Sign-in methods</h3><p className="body-copy">Link both methods to keep one account and the same saved profile.</p><div className="info-row"><span>Email and password</span><b>{passwordLinked?'Connected':'Not connected'}</b></div><div className="info-row"><span>Google</span><b>{googleLinked?'Connected':'Not connected'}</b></div>{!googleLinked&&<button type="button" className="button secondary" onClick={()=>void addGoogle()}>Link Google account</button>}{!passwordLinked&&<form className="auth-form account-link-form" onSubmit={addPassword}><label>Create a password for this account<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label><button className="button">Add password sign-in</button></form>}{message&&<p className="tiny-note">{message}</p>}</div>}
function UserSettings({data,setData,flash}:{data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;flash:(s:string)=>void}){
  const u=data.user!;
  const [avatarImageFailed,setAvatarImageFailed]=useState(false);
  const [name,setName]=useState(u.name);
  const [org,setOrg]=useState(u.org==='Not provided'?'':u.org);
  const [offers,setOffers]=useState(u.offers||'');
  const [saving,setSaving]=useState(false);
  const handleSave=async(e:React.FormEvent)=>{
    e.preventDefault();
    setSaving(true);
    const chosenName=name.trim()||u.name;
    const chosenOrg=org.trim()||u.org;
    const updated:User={...u,name:chosenName,org:chosenOrg,offers};
    setData(d=>({...d,user:updated}));
    if(firebaseConfigured&&auth?.currentUser&&db&&u.role!=='admin'){
      try{
        await setDoc(doc(db,'users',auth.currentUser.uid),{
          name:chosenName,
          org:chosenOrg,
          offers,
          updatedAt:serverTimestamp()
        },{merge:true});
        flash('Profile settings saved.');
      }catch(err){
        console.warn('Could not save to Firebase:',err);
        flash('Profile updated locally.');
      }
    }else{
      flash('Profile settings updated.');
    }
    setSaving(false);
  };

  const roleTitle=u.role==='student'?'Student':u.role==='college'?'College Admin':u.role==='company'?'Recruiter':'Administrator';

  return (
    <div style={{display:'grid',gap:'24px',maxWidth:'780px'}}>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Profile & Account Settings</h3>
            <p>Update your personal display details and organization information.</p>
          </div>
          <SettingsIcon size={22} color="#7c3aed"/>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:'18px',padding:'16px 0',borderBottom:'1px solid #f3f4f6',marginBottom:'20px'}}>
          <div className="avatar" style={{width:'56px',height:'56px',fontSize:'20px'}}>
            {u.photoURL&&!avatarImageFailed?<img src={u.photoURL} alt="" onError={()=>setAvatarImageFailed(true)} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>:u.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div>
            <div style={{fontSize:'18px',fontWeight:800,color:'#111827'}}>{u.name}</div>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'4px',flexWrap:'wrap'}}>
              <span className="mail-chip" style={{fontSize:'12px'}}><Mail size={12}/> {u.email}</span>
              <span className="verified-chip" style={{fontSize:'11px'}}><Check size={11}/> Verified</span>
              <span style={{fontSize:'11px',background:'#ede9fe',color:'#6d28d9',fontWeight:700,padding:'3px 10px',borderRadius:'12px'}}>
                {roleTitle} Workspace
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="auth-form" style={{maxWidth:'500px'}}>
          <label>
            Full Name / Display Name
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" required/>
          </label>
          <label>
            {u.role==='company'?'Company Name':'College / Institution Name'}
            <input value={org} onChange={e=>setOrg(e.target.value)} placeholder={u.role==='company'?'e.g. Northstar Labs':'e.g. Lakeside University'} required/>
          </label>
          {u.role!=='student'&&<label>
            {u.role==='company'?'Roles, internships, and opportunities':'Programs, placements, and student support'}
            <textarea value={offers} onChange={e=>setOffers(e.target.value)} rows={4} maxLength={1200} placeholder={u.role==='company'?'e.g. Frontend internships, data analyst placements, mentorship':'e.g. Career placement support, industry projects, research programs, mentoring'} />
          </label>}
          <label>
            Workspace Role
            <input value={`${roleTitle} Workspace`} disabled style={{background:'#f9fafb',cursor:'not-allowed',color:'#6b7280'}}/>
          </label>
          <button type="submit" className="button" disabled={saving}>
            {saving?'Saving changes...':'Save Profile Changes'}
          </button>
        </form>
      </div>

      <GoalsEditor data={data} setData={setData} flash={flash}/>

      <AccountConnections email={u.email}/>
    </div>
  );
}
function ApiKeySettings(){
  type ProviderModel={id:string;displayName:string;inputTokenLimit:number|null;outputTokenLimit:number|null;supportedAction?:string};
  type Provider='openai'|'gemini';
  type SavedProviderKey={id:string;provider:Provider;label:string;models:string[]|null;createdAt:string|null;updatedAt?:string|null};
  type Usage={requests:number;inputTokens:number;outputTokens:number;totalTokens:number;openaiTokens?:number;geminiTokens?:number;openaiRequests?:number;geminiRequests?:number;month?:string;byModel?:{provider:Provider;model:string;requests:number;inputTokens:number;outputTokens:number;totalTokens:number}[]};
  const [provider,setProvider]=useState<Provider>('openai');
  const [model,setModel]=useState('gpt-4o-mini');
  const [models,setModels]=useState<ProviderModel[]>([]);
  const [selectedModels,setSelectedModels]=useState<string[]>([]);
  const [modelAccessKeyId,setModelAccessKeyId]=useState('');
  const [keyProvider,setKeyProvider]=useState<Provider|''>('');
  const [providerMenuOpen,setProviderMenuOpen]=useState(false);
  const [keyValue,setKeyValue]=useState('');
  const [keyLabel,setKeyLabel]=useState('');
  const [keyFormError,setKeyFormError]=useState('');
  const [editingKeyId,setEditingKeyId]=useState('');
  const [importTab,setImportTab]=useState<'key'|'file'|'custom'>('key');
  const [pasteSeveral,setPasteSeveral]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [modelAccessOpen,setModelAccessOpen]=useState(false);
  const [status,setStatus]=useState<{openaiConfigured:boolean;geminiConfigured:boolean;openaiLabel:string;geminiLabel:string;openaiModels:string[]|null;geminiModels:string[]|null;providerKeys:SavedProviderKey[];updatedAt:string|null;updatedBy:string;usage?:Usage}|null>(null);
  const [message,setMessage]=useState('');
  const [messageError,setMessageError]=useState(false);
  const [busy,setBusy]=useState(false);
  const [authorized,setAuthorized]=useState(false);
  const [settingsLoading,setSettingsLoading]=useState(true);
  useEffect(()=>{let active=true;const load=async()=>{
    const account=auth?.currentUser;
    if(!hasPlatformAdminAccess(account)){if(active){setMessage('Sign in with an authorized administrator account to manage AI settings.');setSettingsLoading(false)}return}
    if(active)setAuthorized(true);
    if(!auth){if(active){setMessage('Firebase is not configured in this environment, so AI settings cannot load.');setMessageError(true);setSettingsLoading(false)}return}
    try{const call=callBackend('getAiConfiguration');const result=await call();if(active){const saved=result.data as {provider:Provider;model:string;openaiConfigured:boolean;geminiConfigured:boolean;openaiLabel?:string;geminiLabel?:string;openaiModels?:string[]|null;geminiModels?:string[]|null;providerKeys?:SavedProviderKey[];updatedAt:string|null;updatedBy:string;usage?:Usage};setProvider(saved.provider);setModel(saved.model);setStatus({openaiConfigured:saved.openaiConfigured,geminiConfigured:saved.geminiConfigured,openaiLabel:saved.openaiLabel||'OpenAI key',geminiLabel:saved.geminiLabel||'Gemini key',openaiModels:saved.openaiModels||null,geminiModels:saved.geminiModels||null,providerKeys:saved.providerKeys||[],updatedAt:saved.updatedAt,updatedBy:saved.updatedBy,usage:saved.usage});setSettingsLoading(false)}}
    catch(error){if(active){const code=(error as {code?:string})?.code||'';const detail=error instanceof Error?error.message:'';const text=code==='functions/not-found'?'The AI settings service is not deployed yet. Deploy the Supabase Edge Function.':code==='functions/internal'||detail.includes('internal')?'The Supabase AI service returned an internal error. Check the Edge Function logs and server secrets if it continues.':`Could not load AI settings${code?` (${code})`:''}${detail?`: ${detail}`:'.'}`;setMessage(text);setMessageError(true);setSettingsLoading(false)}}
  };void load();return()=>{active=false}},[]);
  const addKey=async(e:React.FormEvent)=>{e.preventDefault();if(!auth||!authorized)return;if(!keyProvider){setKeyFormError('Select a provider first.');return}const selectedProvider=keyProvider as Provider;const pastedKeys=pasteSeveral?keyValue.split(/[\r\n,;]+/).map(value=>value.trim()).filter(Boolean):[keyValue.trim()];if(!pastedKeys.length||pastedKeys.some(key=>!key)){setKeyFormError('Paste a valid API key to continue.');return}setKeyFormError('');setBusy(true);setMessage('');setMessageError(false);try{
    const lookup=callBackend('listAiModels');const prepared:{key:string;models:ProviderModel[]}[]=[];
    for(const key of pastedKeys){const result=await lookup({provider:selectedProvider,apiKey:key});const available=(result.data as {models:ProviderModel[]}).models||[];if(!available.length)throw new Error('A key did not return any supported text-generation models. Check each pasted key.');prepared.push({key,models:available})}
    if(editingKeyId){
      const replace=callBackend('replaceAiProviderKey');await replace({keyId:editingKeyId,apiKey:prepared[0].key});
      const changedAt=new Date().toISOString();setStatus(current=>current?({...current,providerKeys:current.providerKeys.map(item=>item.id===editingKeyId?{...item,updatedAt:changedAt}:item),updatedAt:changedAt,updatedBy:'You'}):current);
      setKeyValue('');setEditingKeyId('');setAddOpen(false);setMessage('API key replaced and checked. Existing model access settings were kept.');setMessageError(false);return;
    }
    const add=callBackend('addAiProviderKey');const addedKeys:{id:string;provider:Provider;label:string;models:string[]|null;createdAt:string|null}[]=[];
    for(let i=0;i<prepared.length;i++){const label=keyLabel.trim()?(prepared.length>1?`${keyLabel.trim()} ${i+1}`:keyLabel.trim()):`${selectedProvider==='openai'?'OpenAI':'Gemini'} key${prepared.length>1?` ${i+1}`:''}`;const result=await add({provider:selectedProvider,apiKey:prepared[i].key,label});addedKeys.push({id:(result.data as {id:string}).id,provider:selectedProvider,label,models:null,createdAt:new Date().toISOString()})}
    const firstModels=prepared[0].models;const ids=firstModels.map(item=>item.id);const preferredModel=selectedProvider==='gemini'?'gemini-2.5-flash':'gpt-4o-mini';const selectedModel=provider===selectedProvider&&ids.includes(model)&&!/(preview|experimental|antigravity)/i.test(model)?model:ids.includes(preferredModel)?preferredModel:ids[0];const saveConfig=callBackend('saveAiConfiguration');await saveConfig({provider:selectedProvider,model:selectedModel});
    setModelAccessKeyId(addedKeys[0].id);setModels(firstModels);setSelectedModels(ids);setProvider(selectedProvider);setModel(selectedModel);setStatus(current=>({openaiConfigured:selectedProvider==='openai'||Boolean(current?.openaiConfigured),geminiConfigured:selectedProvider==='gemini'||Boolean(current?.geminiConfigured),openaiLabel:current?.openaiLabel||'OpenAI key',geminiLabel:current?.geminiLabel||'Gemini key',openaiModels:current?.openaiModels||null,geminiModels:current?.geminiModels||null,providerKeys:[...(current?.providerKeys||[]),...addedKeys],updatedAt:new Date().toISOString(),updatedBy:'You',usage:current?.usage}));
    setKeyValue('');setAddOpen(false);setModelAccessOpen(true);setMessage(`${addedKeys.length===1?'Key added':'Keys added'}. Choose which models ${addedKeys.length===1?'it':'the first key'} can serve.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Could not add this key. Check the provider and key.');setMessageError(true)}finally{setBusy(false)}};  const saveModelAccess=async()=>{if(!auth||!authorized)return;setBusy(true);setMessage('');setMessageError(false);const modelsToSave=selectedModels.length===models.length?null:selectedModels;try{const save=callBackend('saveAiKeyModelAccess');await save({keyId:modelAccessKeyId,models:modelsToSave});setStatus(current=>current?({...current,providerKeys:current.providerKeys.map(item=>item.id===modelAccessKeyId?{...item,models:modelsToSave}:item),updatedAt:new Date().toISOString(),updatedBy:'You'}):current);setModelAccessOpen(false);setMessage(modelsToSave===null?'Saved: this key can serve all current and future models.':`Saved ${selectedModels.length} model${selectedModels.length===1?'':'s'} for this ${keyProvider==='openai'?'OpenAI':'Gemini'} key.`)}catch(error){setMessage(error instanceof Error?error.message:'Could not save model access.');setMessageError(true)}finally{setBusy(false)}};
  const manageModels=async(entry:SavedProviderKey)=>{if(!auth)return;setBusy(true);setMessage('');setMessageError(false);try{const call=callBackend('listAiModels');const result=await call({provider:entry.provider,keyId:entry.id});const available=(result.data as {models:ProviderModel[]}).models||[];if(!available.length)throw new Error('This key returned no supported text-generation models.');setModels(available);setModelAccessKeyId(entry.id);setKeyProvider(entry.provider);setSelectedModels(entry.models===null?available.map(item=>item.id):entry.models.filter(id=>available.some(item=>item.id===id)));setModelAccessOpen(true)}catch(error){setMessage(error instanceof Error?error.message:'Could not load models for this key.');setMessageError(true)}finally{setBusy(false)}};
  const removeProviderKey=async(id:string)=>{if(!auth)return;setBusy(true);try{const call=callBackend('removeAiProviderKey');await call({keyId:id});setStatus(current=>current?({...current,providerKeys:current.providerKeys.filter(item=>item.id!==id),updatedAt:new Date().toISOString(),updatedBy:'You'}):current);setMessage('Provider key removed.');setMessageError(false)}catch(error){setMessage(error instanceof Error?error.message:'Could not remove this key.');setMessageError(true)}finally{setBusy(false)}};
  const editProviderKeyLabel=async(entry:SavedProviderKey)=>{const label=window.prompt('Edit the key label. The API key itself is hidden and cannot be read back.',entry.label)?.trim();if(!label||label===entry.label)return;if(!auth)return;setBusy(true);setMessage('');setMessageError(false);try{const call=callBackend('updateAiProviderKeyLabel');await call({keyId:entry.id,label});setStatus(current=>current?({...current,providerKeys:current.providerKeys.map(item=>item.id===entry.id?{...item,label}:item),updatedAt:new Date().toISOString(),updatedBy:'You'}):current);setMessage('Key label updated.')}catch(error){setMessage(error instanceof Error?error.message:'Could not update the key label.');setMessageError(true)}finally{setBusy(false)}};
  const importKeyFile=async(file?:File)=>{if(!file)return;try{const text=await file.text();let value='';let detected:Provider|undefined;try{const json=JSON.parse(text) as Record<string,unknown>;const openai=json.openaiKey||json.OPENAI_API_KEY;const gemini=json.geminiApiKey||json.GEMINI_API_KEY;if(typeof openai==='string'){value=openai;detected='openai'}else if(typeof gemini==='string'){value=gemini;detected='gemini'}else if(typeof json.apiKey==='string')value=json.apiKey}catch{const openai=text.match(/^\s*(?:OPENAI_API_KEY|VITE_OPENAI_API_KEY)\s*=\s*["']?([^\r\n"']+)/m);const gemini=text.match(/^\s*(?:GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*["']?([^\r\n"']+)/m);if(openai){value=openai[1].trim();detected='openai'}else if(gemini){value=gemini[1].trim();detected='gemini'}else value=text.trim()}if(!value)throw new Error('No supported API key was found in that file.');setKeyValue(value);if(detected)setKeyProvider(detected);setImportTab('key');setMessage('Key imported into the form. It has not been saved yet.')}catch(error){setMessage(error instanceof Error?error.message:'Could not read that key file.');setMessageError(true)}};
  const monthlyModels=status?.usage?.byModel||[];
  const monthlyTokenTotal=monthlyModels.reduce((sum,item)=>sum+item.totalTokens,0);
  const monthlyRequests=monthlyModels.reduce((sum,item)=>sum+item.requests,0);
  const providerUsage=[{provider:'openai',label:'OpenAI',tokens:monthlyModels.filter(item=>item.provider==='openai').reduce((sum,item)=>sum+item.totalTokens,0),requests:monthlyModels.filter(item=>item.provider==='openai').reduce((sum,item)=>sum+item.requests,0)},{provider:'gemini',label:'Google AI Studio',tokens:monthlyModels.filter(item=>item.provider==='gemini').reduce((sum,item)=>sum+item.totalTokens,0),requests:monthlyModels.filter(item=>item.provider==='gemini').reduce((sum,item)=>sum+item.requests,0)}] as const;
  const hasConfiguredProvider=Boolean(status&&(status.providerKeys.length>0||status.openaiConfigured||status.geminiConfigured));  return <div className="content-grid api-key-settings"><section className="panel wide"><div className="panel-head"><div><h3>AI provider keys</h3><p>Add a provider key, choose which models it may serve, and track SkillBridge token use.</p></div><ShieldCheck/></div><section className="ai-usage-panel-inline">
  <div className="ai-monthly-head">
    <div><h3>Monthly SkillBridge token usage</h3><small>Tokens from successful AI requests {'\u00b7'} {status?.usage?.month||new Date().toISOString().slice(0,7)}</small></div>
    <div className="ai-budget-summary"><b>{monthlyTokenTotal.toLocaleString()} tokens used</b><span>{monthlyRequests.toLocaleString()} requests {'\u00b7'} Remaining balance unavailable</span></div>
  </div>
  <div className={`ai-monthly-bar ${monthlyModels.length?'':'empty'}`} role="img" aria-label={monthlyModels.length?'Share of SkillBridge token usage by model':'No model token usage recorded yet'}>
    {monthlyModels.map(item=><i key={`${item.provider}-${item.model}`} className={item.provider} title={`${item.model}: ${item.totalTokens.toLocaleString()} tokens`} style={{width:`${monthlyTokenTotal?item.totalTokens/monthlyTokenTotal*100:0}%`}}/>)}
  </div>
  <div className="ai-provider-usage-summary" aria-label="Token usage by provider">{providerUsage.map(item=><div className={`ai-provider-usage ${item.provider}`} key={item.provider}><span className={`ai-usage-dot ${item.provider}`}/><b>{item.label}</b><strong>{item.tokens.toLocaleString()} tokens</strong><small>{item.requests.toLocaleString()} requests</small></div>)}</div>
  {monthlyModels.length?<div className="ai-monthly-models">{[...monthlyModels].sort((a,b)=>b.totalTokens-a.totalTokens).map(item=><div className="ai-monthly-model" key={`${item.provider}-${item.model}`}><span className={`ai-usage-dot ${item.provider}`}/><span className="ai-usage-model-name"><b>{item.model}</b><small>{item.provider==='openai'?'OpenAI':'Google AI Studio'} {'\u00b7'} {item.requests} request{item.requests===1?'':'s'}</small></span><span className="ai-usage-model-count"><b>{item.totalTokens.toLocaleString()}</b><small>{item.inputTokens.toLocaleString()} in {'\u00b7'} {item.outputTokens.toLocaleString()} out</small></span></div>)}</div>:<div className="ai-budget-empty"><b>{hasConfiguredProvider?'No model usage yet':'No API key connected yet'}</b><span>{hasConfiguredProvider?'Monthly tokens will appear here after the first successful AI request.':'Add a provider API key below; SkillBridge will show model usage after its first AI request.'}</span></div>}
  <p className="tiny-note">Provider account quota and remaining balance aren’t exposed by these API keys. This panel tracks SkillBridge usage only.</p>
</section><ProviderKeyManager loaded={Boolean(status)} loading={settingsLoading} loadError={message} keys={status?.providerKeys||[]} configured={{openai:Boolean(status?.openaiConfigured),gemini:Boolean(status?.geminiConfigured)}} busy={busy} onEditName={entry=>void editProviderKeyLabel(entry)} onReplace={entry=>{setEditingKeyId(entry.id);setKeyProvider(entry.provider);setKeyValue('');setKeyLabel('');setPasteSeveral(false);setKeyFormError('');setImportTab('key');setAddOpen(true)}} onEditModels={entry=>void manageModels(entry)} onDelete={entry=>{if(window.confirm(`Delete ${entry.label}? This removes the saved key from SkillBridge.`))void removeProviderKey(entry.id)}} /><button type="button" className="button" onClick={()=>{setEditingKeyId('');setKeyValue('');setKeyLabel('');setKeyProvider('');setPasteSeveral(false);setKeyFormError('');setImportTab('key');setAddOpen(true)}} disabled={!authorized||!status}>Add API key <ArrowRight size={15}/></button>{status&&<><div className="info-row"><span>Primary provider and model</span><b>{provider==='openai'?'OpenAI':'Gemini'} · {model}</b></div><div className="info-row"><span>SkillBridge total usage</span><b>{(status.usage?.totalTokens||0).toLocaleString()} tokens · {(status.usage?.requests||0).toLocaleString()} requests</b></div><div className="ai-token-breakdown"><span>Input <b>{(status.usage?.inputTokens||0).toLocaleString()}</b></span><span>Output <b>{(status.usage?.outputTokens||0).toLocaleString()}</b></span><span>OpenAI <b>{(status.usage?.openaiTokens||0).toLocaleString()}</b></span><span>Gemini <b>{(status.usage?.geminiTokens||0).toLocaleString()}</b></span></div>{status.updatedAt&&<p className="tiny-note">Last saved {new Date(status.updatedAt).toLocaleString()} by {status.updatedBy}.</p>}</>}<p className="tiny-note">Token totals track SkillBridge requests only, starting after usage tracking is deployed. They do not show provider account remaining quota.</p>{message&&status&&<p className={`tiny-note ${messageError?'ai-config-error':''}`} role="status">{message}</p>}</section><section className="panel"><h3>Key routing</h3><p className="body-copy">Each saved key is restricted to its checked models. The AI router skips that key for models you uncheck.</p><p className="tiny-note">Keys are write-only and never sent back to the browser. Gemini publishes model token limits; OpenAI’s model list does not include context limits.</p></section>
  {addOpen&&<div className="ai-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setAddOpen(false)}}><section className="ai-modal ai-add-modal" role="dialog" aria-modal="true" aria-labelledby="add-ai-key-title"><button className="ai-modal-close" type="button" onClick={()=>{setAddOpen(false);setEditingKeyId("")}} aria-label="Close">×</button><h2 id="add-ai-key-title">{editingKeyId?"Replace API key":"Add key"}</h2><div className="ai-modal-tabs"><button type="button" className={importTab==='key'?'selected':''} onClick={()=>setImportTab('key')}>Provider key</button><button type="button" className={importTab==='file'?'selected':''} onClick={()=>setImportTab('file')}>Import file</button><button type="button" className={importTab==='custom'?'selected':''} onClick={()=>setImportTab('custom')}>Custom endpoint</button></div>{importTab==='custom'?<div className="ai-custom-endpoint-note"><b>Custom endpoint</b><p>SkillBridge currently connects directly to OpenAI and Google AI Studio. Custom endpoint routing is not enabled yet.</p></div>:<><form noValidate onSubmit={addKey}><div className="ai-add-key-grid"><label>Platform<div className="ai-provider-select"><button type="button" className="ai-provider-select-trigger" disabled={Boolean(editingKeyId)} aria-haspopup="listbox" aria-expanded={providerMenuOpen} onKeyDown={e=>{if(e.key==='Escape')setProviderMenuOpen(false)}} onClick={()=>setProviderMenuOpen(open=>!open)}><span>{keyProvider==='openai'?'OpenAI':keyProvider==='gemini'?'Google AI Studio':'Select a provider'}</span><ChevronDown size={16}/></button>{providerMenuOpen&&<div className="ai-provider-select-menu" role="listbox" aria-label="Select a provider">{([{value:'openai',label:'OpenAI'},{value:'gemini',label:'Google AI Studio'}] as const).map(option=><button type="button" role="option" aria-selected={keyProvider===option.value} className={keyProvider===option.value?'selected':''} key={option.value} onClick={()=>{setKeyProvider(option.value);setKeyFormError('');setProviderMenuOpen(false)}}>{option.label}{keyProvider===option.value&&<Check size={14}/>}</button>)}</div>}</div></label><label className="ai-key-entry-label"><span>API key <button type="button" className="ai-paste-several" disabled={Boolean(editingKeyId)} onClick={()=>setPasteSeveral(value=>!value)}>{pasteSeveral?'Paste one key':'Paste several'}</button></span>{pasteSeveral?<textarea value={keyValue} onChange={e=>setKeyValue(e.target.value)} placeholder="Paste one API key per line" rows={3}/>:<input type="password" autoComplete="new-password" value={keyValue} onChange={e=>setKeyValue(e.target.value)} placeholder="paste key here" minLength={20} maxLength={512}/>}</label>{importTab==='file'&&<label className="ai-import-inline">Import keys from a file<input type="file" accept=".env,.txt,.json" onChange={e=>void importKeyFile(e.target.files?.[0])}/></label>}{!editingKeyId&&<label>Label <small>optional</small><input value={keyLabel} onChange={e=>setKeyLabel(e.target.value)} maxLength={60} placeholder="optional"/></label>}<button type="submit" className="button ai-add-submit" disabled={busy||!keyProvider||!keyValue.trim()}>{busy?'Checking key…':editingKeyId?'Replace key':'Add key'}</button>{keyFormError&&<p className="ai-key-form-error" role="alert">{keyFormError}</p>}</div></form><p className="tiny-note">Keys are checked against the provider before they are saved.</p></>}</section></div>}  {modelAccessOpen&&<div className="ai-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setModelAccessOpen(false)}}><section className="ai-modal ai-model-modal" role="dialog" aria-modal="true" aria-labelledby="model-access-title"><h2 id="model-access-title">Which models should this key serve?</h2><p className="body-copy">Your {keyProvider==='gemini'?'Google AI Studio':'OpenAI'} key currently serves {selectedModels.length===models.length?'every model below':`${selectedModels.length} selected models`}. Uncheck any model this key is not allowed to use; the router skips it for those.</p><div className="ai-model-select-all"><label><input type="checkbox" checked={selectedModels.length===models.length&&models.length>0} onChange={e=>setSelectedModels(e.target.checked?models.map(item=>item.id):[])}/> Select all</label><span>{selectedModels.length} of {models.length} selected</span></div><div className="ai-model-list">{models.length?models.map(item=><label className="ai-model-row" key={item.id}><input type="checkbox" checked={selectedModels.includes(item.id)} onChange={e=>setSelectedModels(current=>e.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/><span><b>{item.displayName}</b><small>{item.id}</small></span><em>{item.supportedAction||'Text generation'}</em><em>{item.inputTokenLimit?`${(item.inputTokenLimit/1000).toLocaleString()}K ctx`:'Limit varies'}</em>{item.outputTokenLimit&&<em>{(item.outputTokenLimit/1000).toLocaleString()}K max</em>}</label>):<div className="ai-model-empty">No live model list is available. Close this dialog and load models with the saved key.</div>}</div><p className="tiny-note">{selectedModels.length===models.length?'Everything selected — current and future models can use this key.':`${models.length-selectedModels.length} model${models.length-selectedModels.length===1?'':'s'} excluded from this key.`}</p><div className="ai-modal-actions"><button type="button" className="button secondary" onClick={()=>setModelAccessOpen(false)}>Not now</button><button type="button" className="button" disabled={busy||!models.length} onClick={()=>void saveModelAccess()}>{busy?'Saving…':'Save'}</button></div></section></div>}
  </div>
}function DashboardContent({page,data,setData,user,flash,navigate,adminAccess}:{page:string;data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;user:User;flash:(s:string)=>void;navigate:(page:string)=>void;adminAccess:boolean}){
 if(page==='AI Configuration'&&adminAccess)return <ApiKeySettings/>;
 if(page==='Branding'&&adminAccess&&isPlatformAdminEmail(user.email))return <BrandingSettings flash={flash}/>;
 if(page==='Settings')return <UserSettings data={data} setData={setData} flash={flash}/>;
 const effectiveData={...data,user};
 const network=networkViewFor(user.role,page);
 if(network)return <NetworkDirectory view={network} data={effectiveData} flash={flash}/>;
 if(page==='AI Resume Assessment'&&user.role==='student')return <CareerAssessment flash={flash} resumes={savedResumes(data)} savedResumeText={data.resumeText||''} onScore={score=>setData(d=>({...d,results:[...d.results,score]}))}/>;
 if(page==='Mock Tests & Offers'&&user.role==='student')return <MockTestsOffers flash={flash}/>;
 if(user.role==='student')return <StudentContent page={page} data={effectiveData} setData={setData} flash={flash} navigate={navigate}/>;
 if(page==='Student Requests'&&(user.role==='college'||user.role==='company'))return <ConnectionRequests data={effectiveData} flash={flash}/>;
 return <OrgContent role={user.role} page={page} data={effectiveData} setData={setData} flash={flash}/>;
}const demoQuestionBank=[
 {id:'variables',topic:'Programming basics',question:'What is a variable used for in a program?',options:['To store a value','To repeat code','To stop the computer','To design a webpage'],correct:0},
 {id:'conditions',topic:'Programming basics',question:'What does an if/else statement help a program do?',options:['Store many values','Choose what to do based on a condition','Repeat code forever','Rename a file'],correct:1},
 {id:'loops',topic:'Programming basics',question:'What is a loop used for?',options:['To repeat instructions','To store a password','To create a new file','To display an image'],correct:0},
 {id:'functions',topic:'Programming basics',question:'What is a function?',options:['A reusable block of code','A type of computer','A place to store pictures','A web browser'],correct:0},
 {id:'arrays',topic:'Programming basics',question:'What is an array commonly used to store?',options:['A collection of values','One instruction only','A webpage layout','A computer setting'],correct:0},
 {id:'parameters',topic:'Programming basics',question:'What is a parameter in a function?',options:['An input the function can use','The final screen color','A database table','A way to stop the app'],correct:0},
 {id:'boolean',topic:'Programming basics',question:'Which values are usually used for a Boolean?',options:['True and false','High and low','Start and stop','Left and right'],correct:0},
 {id:'debugging',topic:'Problem solving',question:'What is debugging?',options:['Finding and fixing problems in code','Adding more users','Designing a logo','Compressing images'],correct:0},
 {id:'algorithm',topic:'Problem solving',question:'What is an algorithm?',options:['A step-by-step method for solving a problem','A type of keyboard','A file format','A computer screen'],correct:0},
 {id:'html',topic:'Web development',question:'What is HTML mainly used for?',options:['Structuring content on a webpage','Storing passwords securely','Managing database backups','Editing audio'],correct:0},
 {id:'css',topic:'Web development',question:'What is CSS mainly used for?',options:['Styling webpage content','Running database queries','Encrypting a network','Writing operating systems'],correct:0},
 {id:'javascript',topic:'Web development',question:'What can JavaScript add to a webpage?',options:['Interactive behavior','A physical network cable','More monitor pixels','A new file system'],correct:0},
 {id:'http',topic:'Web development',question:'What does HTTPS help provide?',options:['Encrypted communication with a website','Faster keyboard typing','Extra storage on a device','Automatic code formatting'],correct:0},
 {id:'api',topic:'Web development',question:'What is an API commonly used for?',options:['Letting software systems communicate','Drawing images by hand','Cooling a computer','Changing screen brightness'],correct:0},
 {id:'database',topic:'Data and databases',question:'What is a database used for?',options:['Organizing and storing information','Displaying animations','Formatting source code','Connecting a mouse'],correct:0},
 {id:'sql',topic:'Data and databases',question:'Which SQL command is commonly used to read rows from a table?',options:['SELECT','PAINT','LAUNCH','FORMAT'],correct:0},
 {id:'primary-key',topic:'Data and databases',question:'What does a primary key do in a database table?',options:['Uniquely identifies a row','Changes the page layout','Encrypts every network packet','Starts a program loop'],correct:0},
 {id:'null',topic:'Data and databases',question:'In a database, what does NULL usually represent?',options:['A missing or unknown value','The number zero in every case','A duplicate table','A successful login'],correct:0},
 {id:'passwords',topic:'Security',question:'Which is the safest password practice?',options:['Use a long, unique password for each account','Reuse one short password everywhere','Share passwords with teammates','Save passwords in a public document'],correct:0},
 {id:'phishing',topic:'Security',question:'What is a common sign of a phishing message?',options:['A suspicious link asking you to act urgently','A normal message from a known contact','A saved calendar reminder','A software update from the official app'],correct:0},
 {id:'secrets',topic:'Security',question:'Where should a private API key be kept?',options:['In a protected server-side secret store','In public website code','In a public source repository','Inside a screenshot'],correct:0},
 {id:'git',topic:'Developer tools',question:'What is Git commonly used for?',options:['Tracking changes to files over time','Hosting a video call','Creating database passwords','Measuring internet speed'],correct:0},
 {id:'testing',topic:'Developer tools',question:'Why do developers write tests?',options:['To check that code behaves as expected','To make a website visible in search','To increase file size','To replace user feedback'],correct:0},
 {id:'responsive',topic:'Web development',question:'What does responsive web design help a page do?',options:['Adapt its layout to different screen sizes','Respond only to keyboard input','Store user passwords','Run without a browser'],correct:0},
 {id:'accessibility',topic:'Web development',question:'Which choice improves accessibility for images?',options:['Provide meaningful alternative text','Use only low-contrast colors','Put important text only in images','Remove labels from controls'],correct:0},
];
function pickDemoAssessmentQuestions(used:Set<string>){let available=demoQuestionBank.filter(question=>!used.has(question.id));if(available.length<5){used.clear();available=[...demoQuestionBank]}for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]]}const picked=available.slice(0,5);picked.forEach(question=>used.add(question.id));return picked}
function StudentContent({page,data,setData,flash,navigate}:{page:string;data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;flash:(s:string)=>void;navigate:(page:string)=>void}){const [questionIndex,setQuestionIndex]=useState(0);const [answers,setAnswers]=useState<number[]>([]);const usedQuestions=useRef(new Set<string>());const [activeQuestions,setActiveQuestions]=useState<typeof demoQuestionBank>([]);const [reviewAnswers,setReviewAnswers]=useState<number[]|null>(null);const [exam,setExam]=useState(false);const [selectedResumeId,setSelectedResumeId]=useState('');const [resumeBusy,setResumeBusy]=useState(false);const [resumeUploadProgress,setResumeUploadProgress]=useState<number|null>(null);const [resumeElapsedSeconds,setResumeElapsedSeconds]=useState(0);const resumeStartedAt=useRef(0);const resumeProcessing=resumeBusy||resumeUploadProgress!==null;useEffect(()=>{if(!resumeProcessing)return;const updateElapsed=()=>setResumeElapsedSeconds(Math.floor((Date.now()-resumeStartedAt.current)/1000));updateElapsed();const timer=window.setInterval(updateElapsed,250);return()=>window.clearInterval(timer)},[resumeProcessing]);const resumeList=savedResumes(data);const currentResume=resumeList.find(r=>r.id===selectedResumeId)||resumeList.at(-1);const extractedResumeIds=useRef(new Set<string>());useEffect(()=>{if(page!=='Resume Analysis'||!currentResume||currentResume.text.trim().length>=50||!currentResume.storagePath||!storage||extractedResumeIds.current.has(currentResume.id))return;extractedResumeIds.current.add(currentResume.id);let active=true;void getBytes(ref(storage,currentResume.storagePath),5*1024*1024).then(bytes=>extractResumeText(currentResume.name,bytes)).then(text=>{if(!active)return;setData(d=>({...d,resumes:savedResumes(d).map(r=>r.id===currentResume.id?{...r,text}:r),resumeName:currentResume.name,resumeText:text}));flash(text?'Resume text extracted and saved for AI assessment.':'No selectable text was found. This may be a scanned PDF; paste its text manually.');}).catch(()=>{if(active)flash('Could not read this saved resume. Please upload it again or paste its text manually.')});return()=>{active=false}},[page,currentResume?.id,currentResume?.storagePath,currentResume?.text]);const selectResume=(id:string)=>{setSelectedResumeId(id);const chosen=resumeList.find(r=>r.id===id);if(chosen)setData(d=>({...d,resumeName:chosen.name,resumeText:chosen.text}))};const addResumeFiles=async(files:File[])=>{if(files.length===0)return;resumeStartedAt.current=Date.now();setResumeElapsedSeconds(0);const valid=files.filter(f=>f.size<5*1024*1024&&(/\.pdf$/i.test(f.name)||/\.docx$/i.test(f.name)));if(valid.length!==files.length)flash('Only PDF/DOCX files under 5 MB can be added.');if(valid.length===0)return;const existing=resumeList.filter(r=>r.id!=='legacy-resume');if(existing.length+valid.length>10){flash('You can save up to 10 resumes.');return}setResumeBusy(true);try{const additions:SavedResume[]=[];for(const file of valid){let text='';try{text=await extractResumeText(file.name,await file.arrayBuffer())}catch(error){console.warn('Could not extract resume text:',error)}additions.push({id:crypto.randomUUID(),name:file.name,text,uploadedAt:new Date().toISOString()})}const latest=additions.at(-1)!;setData(d=>{const next=[...savedResumes(d).filter(r=>r.id!=='legacy-resume'),...additions];return {...d,resumes:next,resumeName:latest.name,resumeText:latest.text}});setSelectedResumeId(latest.id);setResumeBusy(false);flash(additions.some(resume=>!resume.text)?'Resume added, but no selectable text was found. Scanned PDFs need text pasted manually.': 'Resume text extracted and ready for AI assessment.');if(firebaseConfigured&&auth?.currentUser&&data.user?.role!=='admin'&&storage){resumeStartedAt.current=Date.now();setResumeElapsedSeconds(0);setResumeUploadProgress(0);const transferred=valid.map(()=>0);const totalBytes=valid.reduce((sum,file)=>sum+file.size,0);void (async()=>{let uploadTimedOut=false;const activeTasks:ReturnType<typeof uploadBytesResumable>[]=[];const watchdog=window.setTimeout(()=>{uploadTimedOut=true;activeTasks.forEach(task=>task.cancel());setResumeUploadProgress(null);flash('File upload timed out. Your extracted resume text is saved and ready for the AI assessment. Check that Firebase Storage is enabled.')},15000);const results=await Promise.allSettled(valid.map((file,index)=>new Promise<void>((resolve,reject)=>{const resume=additions[index];const uid=auth!.currentUser!.uid;const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const storagePath=`resumes/${uid}/${resume.id}-${safeName}`;const contentType=/\.pdf$/i.test(file.name)?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';const task=uploadBytesResumable(ref(storage!,storagePath),file,{contentType});activeTasks.push(task);let unsubscribe=()=>{};unsubscribe=task.on('state_changed',snapshot=>{if(uploadTimedOut)return;transferred[index]=snapshot.bytesTransferred;setResumeUploadProgress(Math.min(100,Math.round(transferred.reduce((sum,value)=>sum+value,0)/totalBytes*100)))},error=>{unsubscribe();reject(error)},()=>{unsubscribe();if(!uploadTimedOut)setData(d=>({...d,resumes:savedResumes(d).map(item=>item.id===resume.id?{...item,storagePath}:item)}));resolve()})})));window.clearTimeout(watchdog);if(uploadTimedOut)return;if(results.some(result=>result.status==='rejected')){setResumeUploadProgress(null);flash('The resume text is saved and ready for AI assessment, but the file upload failed. Check that Firebase Storage is enabled.')}else{flash('Resume files uploaded successfully.');setResumeUploadProgress(100);window.setTimeout(()=>setResumeUploadProgress(null),1200)}})().catch(error=>{console.error('Resume upload failed:',error);flash('The resume text is ready, but the original file could not be uploaded.');setResumeUploadProgress(null)})}}catch(error){console.error('Could not process resume:',error);flash('Could not read this resume. Please try another PDF or DOCX file.')}finally{setResumeBusy(false)}};const removeResume=async()=>{if(!currentResume)return;try{if(currentResume.storagePath&&storage)await deleteObject(ref(storage,currentResume.storagePath));const next=resumeList.filter(r=>r.id!==currentResume.id);const chosen=next.at(-1);setData(d=>({...d,resumes:next.filter(r=>r.id!=='legacy-resume'),resumeName:chosen?.name||'',resumeText:chosen?.text||''}));setSelectedResumeId(chosen?.id||'');flash('Resume removed.')}catch{flash('Could not remove this resume. Please try again.')}};if(page==='My Profile')return <div className="content-grid"><section className="panel wide"><div className="panel-head"><div><h3>My profile</h3><p>Your account details and the information you share with colleges and companies.</p></div><Users/></div><div className="profile-summary"><div className="avatar profile-avatar">{data.user?.photoURL?<img src={data.user.photoURL} alt=""/>:(data.user?.name||'Student').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div><div><h2>{data.user?.name||'Student'}</h2><p>{data.user?.email||'Add an email address'}</p></div></div><Info label="College or institution" value={data.user?.org||'Not provided'}/><Info label="Workspace" value={data.user?.workspaceRole||data.user?.role||'Student'}/><Info label="Resume" value={data.resumeName||'Not added yet'}/></section><section className="panel"><h3>Profile highlights</h3><div className="stat-grid"><Stat label="Skills" value={`${data.skills.length}`} icon={<Award/>}/><Stat label="Assessments" value={`${data.results.length}`} icon={<Target/>}/><Stat label="Applications" value={`${data.applications.length}`} icon={<BriefcaseBusiness/>}/></div>{data.results.length?<Info label="Latest assessment score" value={`${data.results.at(-1)}%`}/>:<Empty text="Your assessment scores will appear here after you complete an assessment."/>}</section><section className="panel wide"><h3>Skills on your profile</h3><p className="body-copy">These skills help organizations understand your interests and experience.</p><div className="skill-tags">{data.skills.length?data.skills.map(skill=><span key={skill}>{skill}</span>):<Empty text="Add skills from My Skills to build your profile."/>}</div></section></div>;
 if(page==='Resume Analysis')return <div className="content-grid"><section className="panel wide"><div className="panel-head"><div><h3>Resume analysis</h3><p>Keep multiple resumes and choose which one to use for role-specific AI questions.</p></div><FileText/></div><label className="upload-area"><input type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={resumeBusy} onChange={e=>{void addResumeFiles(Array.from(e.target.files||[]));e.currentTarget.value=''}}/><FileText size={25}/><b>{resumeBusy?'Reading resume text…':'Add PDF or DOCX resumes'}</b><span>{resumeList.length?`${resumeList.length} resume${resumeList.length===1?'':'s'} saved · up to 10 files`:'Each file must be under 5 MB'}</span><em>Browse files</em></label>{resumeProcessing&&<div className="resume-upload-status" role="status" aria-live="polite"><div><b>{resumeBusy?'Reading resume text…':resumeUploadProgress===0?'Text extracted · connecting to storage…':`Saving original files · ${resumeUploadProgress}%`}</b><span>{resumeElapsedSeconds}s elapsed</span></div><div className="resume-upload-track"><i className={resumeBusy?'indeterminate':''} style={resumeUploadProgress===null?undefined:{width:`${resumeUploadProgress}%`}}/></div></div>}{resumeList.length>0&&<div className="resume-controls"><label>Resume to edit<select value={currentResume?.id||''} onChange={e=>selectResume(e.target.value)}>{resumeList.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button type="button" className="button secondary small" onClick={()=>void removeResume()}>Remove selected resume</button></div>}<label className="resume-text-editor">Resume text for AI questions<textarea rows={8} maxLength={20000} value={currentResume?.text??data.resumeText??''} onChange={e=>{const text=e.target.value;setData(d=>{if(!currentResume)return {...d,resumeText:text};const list=savedResumes(d).map(r=>r.id===currentResume.id?{...r,text}:r);return {...d,resumes:list,resumeName:currentResume.name,resumeText:text}})}} placeholder="Paste the text from the selected resume here once. It will be saved with that resume."/><small>Text is extracted automatically for text-based PDFs and DOCX files. Scanned PDFs may need their text pasted here manually.</small></label></section><section className="panel"><h3>Resume checklist</h3><ul className="check-list compact"><li><CheckCircle2/> Add your education and experience</li><li><CheckCircle2/> Include projects and measurable outcomes</li><li><CheckCircle2/> List the skills relevant to your target role</li></ul><p className="tiny-note">Choose the resume you want in AI Resume Assessment. General practice questions do not require a resume.</p><button type="button" className="button small" onClick={()=>navigate('AI Resume Assessment')}>Analyze resume with AI <BrandSymbol size={15}/></button></section></div>;if(page==='My Skills')return <Skills data={data} setData={setData} flash={flash}/>;
 if(page==='Assessments'||page==='Exam Schedule'){
  if(reviewAnswers){const correct=reviewAnswers.reduce((total,answer,index)=>total+(answer===activeQuestions[index].correct?1:0),0);const score=Math.round(correct/activeQuestions.length*100);return <div className="panel exam-panel exam-review"><div className="panel-head"><div><div className="eyebrow">DEMO ASSESSMENT REVIEW</div><h2>Assessment complete · {score}%</h2><p>You got {correct} of {activeQuestions.length} correct. Review your answers below.</p></div><Target color="#7c3aed"/></div>{activeQuestions.map((question,index)=>{const picked=reviewAnswers[index];return <article className="exam-review-question" key={question.id}><div className="career-question-meta">QUESTION {index+1} OF {activeQuestions.length}</div><h3>{question.question}</h3><p className={picked===question.correct?'review-correct':'review-incorrect'}>Your answer: {String.fromCharCode(65+picked)}. {question.options[picked]} {picked===question.correct?'· Correct':'· Incorrect'}</p>{picked!==question.correct&&<p className="review-correct">Correct answer: {String.fromCharCode(65+question.correct)}. {question.options[question.correct]}</p>}</article>})}<button className="button" onClick={()=>{setReviewAnswers(null);setAnswers([]);setQuestionIndex(0);setActiveQuestions(pickDemoAssessmentQuestions(usedQuestions.current));setExam(true)}}>Try again <ArrowRight size={16}/></button></div>}
  if(exam){const currentQuestion=activeQuestions[questionIndex];const selectedAnswer=answers[questionIndex];const finishAssessment=()=>{const correct=answers.reduce((total,answer,index)=>total+(answer===activeQuestions[index].correct?1:0),0);const score=Math.round(correct/activeQuestions.length*100);setData(d=>({...d,results:[...d.results,score]}));setExam(false);setQuestionIndex(0);setReviewAnswers([...answers]);flash(`Assessment submitted. Your score: ${score}%`) };return <div className="panel exam-panel"><div className="exam-top"><span>DEMO ASSESSMENT · 5 QUESTIONS</span><span>Question {questionIndex+1} of {activeQuestions.length}</span></div><div className="exam-progress"><i style={{width:`${((questionIndex+1)/activeQuestions.length)*100}%`}}/></div><h2>{currentQuestion.question}</h2>{currentQuestion.options.map((option,index)=><button type="button" key={option} className={`answer-option ${selectedAnswer===index?'chosen':''}`} onClick={()=>setAnswers(previous=>{const next=[...previous];next[questionIndex]=index;return next})}>{String.fromCharCode(65+index)} <span>{option}</span></button>)}<div className="exam-actions">{questionIndex>0&&<button type="button" className="button secondary" onClick={()=>setQuestionIndex(current=>current-1)}>Previous</button>}{questionIndex<activeQuestions.length-1?<button type="button" className="button" disabled={selectedAnswer===undefined} onClick={()=>setQuestionIndex(current=>current+1)}>Next question <ArrowRight size={16}/></button>:<button type="button" className="button" disabled={selectedAnswer===undefined} onClick={finishAssessment}>Submit assessment <ArrowRight size={16}/></button>}</div><p className="tiny-note">Questions are randomly selected across different topics. Your score is saved in this browser.</p></div>}
  return <div className="content-grid"><div className="panel wide"><div className="panel-head"><div><h3>Mixed skills practice</h3><p>Five fresh questions from a varied beginner question bank</p></div><Target/></div><p className="body-copy">Questions rotate across programming, web development, data, security, problem solving, and developer tools. You will not see a question again until the question bank has been used. Your result is stored in this browser.</p><button className="button" onClick={()=>{setReviewAnswers(null);setQuestionIndex(0);setAnswers([]);setActiveQuestions(pickDemoAssessmentQuestions(usedQuestions.current));setExam(true)}}>Start demo assessment <ArrowRight size={16}/></button></div><div className="panel"><h3>Assessment history</h3>{data.results.length?data.results.map((score,index)=><Info key={index} label={`Attempt ${index+1}`} value={`${score}%`} />):<Empty text="No completed assessments yet."/>}</div></div>
 }
 if(page==='Performance')return <div className="content-grid"><div className="panel wide"><div className="panel-head"><div><h3>Measured performance</h3><p>Based on completed assessment attempts in this browser.</p></div><Target/></div>{data.results.length?<><div className="big-number">{Math.round(data.results.reduce((a,b)=>a+b,0)/data.results.length)}<small>% average</small></div>{data.results.map((s,i)=><Skill key={i} label={`Demo attempt ${i+1}`} value={s} color="purple"/>)}</>:<Empty text="Your measured results will appear here after an assessment."/>}</div><div className="panel"><h3>Suggested next steps</h3><p className="body-copy">Demo recommendations are general learning suggestions, not AI-generated or validated resources.</p><ul className="check-list compact"><li><CheckCircle2/> Review React state and props</li><li><CheckCircle2/> Build a small interactive form</li><li><CheckCircle2/> Try another practice question</li></ul></div></div>;
 if(page==='Learning Plan')return <LearningPlan resumeText={[data.resumeText,...(data.resumes||[]).map(resume=>resume.text)].filter(Boolean).join(' ')} skills={data.skills}/>;
 if(page==='Opportunities')return <Marketplace data={data} setData={setData} flash={flash}/>;
 if(page==='My Applications')return <div className="panel"><h3>Your applications</h3>{data.applications.length?data.applications.map(id=>{const o=data.opportunities.find(x=>x.id===id);const application=readDemoApplications().find(a=>a.opportunityId===id&&a.studentEmail===data.user?.email);return <Info key={id} label={o?.title||'Opportunity'} value={application?.status||'Applied'}/>}):<Empty text="You haven't applied to any opportunities yet." action={<Link to="/opportunities" className="text-link">Browse opportunities <ArrowRight size={15}/></Link>}/>}</div>;
 return <div className="content-grid"><div className="panel wide"><div className="panel-head"><div><h3>Your starting point</h3><p>Your workspace fills in as you add real information.</p></div><BrandSymbol/></div><div className="stat-grid"><Stat label="Resume" value={data.resumeName?'Uploaded':'Not added'} icon={<FileText/>}/><Stat label="Skills confirmed" value={`${data.skills.length}`} icon={<Award/>}/><Stat label="Assessments" value={`${data.results.length} completed`} icon={<Target/>}/></div><div className="next-step"><span className="step-icon"><FileText/></span><div><b>Add your resume</b><p>Review your experience and confirm the skills you want to develop.</p></div><button className="text-link" onClick={()=>flash('Choose "My Profile" to add your resume.')}>Get started <ArrowRight size={15}/></button></div></div><div className="panel"><div className="panel-head"><div><h3>Recommended opportunities</h3><p>Browse current demo listings</p></div><BriefcaseBusiness/></div>{data.opportunities.slice(0,2).map(o=><div className="op-mini" key={o.id}><b>{o.title}</b><span>{o.company} · {o.location}</span></div>)}<Link to="/opportunities" className="text-link">See opportunities <ArrowRight size={15}/></Link></div><StudentProgress data={data}/><div className="panel"><h3>Recent activity</h3>{data.results.length?<Info label="Latest assessment" value={`${data.results.at(-1)}%`}/>:<Empty text="Your assessment history will appear here."/>}</div></div>}
function Skills({data,setData,flash}:{data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;flash:(s:string)=>void}){const [val,setVal]=useState('');return <div className="panel"><h3>Skills you confirm</h3><p className="body-copy">Skills below are self-reported by you; demo mode does not extract or verify resume claims.</p><form className="add-skill" onSubmit={e=>{e.preventDefault();const v=val.trim();if(v&&!data.skills.some(s=>s.toLowerCase()===v.toLowerCase()))setData(d=>({...d,skills:[...d.skills,v]}));setVal('')}}><input value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. React"/><button className="button small">Add skill</button></form><div className="skill-tags">{data.skills.length?data.skills.map(s=><button key={s} onClick={()=>{setData(d=>({...d,skills:d.skills.filter(x=>x!==s)}));flash(`${s} removed.`)}}>{s}<X size={13}/></button>):<Empty text="No skills added yet."/>}</div></div>}
function Info({label,value}:{label:string;value:string}){return <div className="info-row"><span>{label}</span><b>{value}</b></div>};function Empty({text,action}:{text:string;action?:React.ReactNode}){return <div className="empty"><span>{text}</span>{action}</div>};function Stat({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="stat"><span className="stat-icon">{icon}</span><small>{label}</small><b>{value}</b></div>}

function Marketplace({data,setData,flash}:{data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;flash:(s:string)=>void}){const [query,setQuery]=useState('');const [kind,setKind]=useState('All types');const [applying,setApplying]=useState<Opportunity|null>(null);const location=useLocation();const inDashboard=location.pathname.startsWith('/app');const previewRole=(location.state as {workspaceRole?:WorkspaceRole}|null)?.workspaceRole;const currentRole=data.user?.role==='admin'&&previewRole?previewRole:data.user?.workspaceRole||data.user?.role;const filtered=data.opportunities.filter(o=>(o.status!=='draft'||data.user?.email===o.ownerEmail)&&(`${o.title} ${o.company} ${o.skills} ${o.location}`.toLowerCase().includes(query.toLowerCase()))&&(kind==='All types'||o.type===kind));return <div className={`market-page${inDashboard?' dashboard-market-page':''}`}>{!inDashboard&&<SiteNavbar mode="page" workspace={Boolean(data.user)}/> }<section className={`market-hero${inDashboard?' dashboard-market-hero':''}`}><div className="eyebrow">{inDashboard?'YOUR NEXT STEP':'OPPORTUNITY MARKETPLACE'}</div><h1>{inDashboard?'Opportunities':'Find a place to grow.'}</h1><p>{inDashboard?'Explore internships and early-career roles that match your skills and goals.':'Explore internships and early-career roles from the SkillBridge demo marketplace.'}</p><div className="market-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, company, skill, or location"/><select value={kind} onChange={e=>setKind(e.target.value)}><option>All types</option>{[...new Set(data.opportunities.map(x=>x.type))].map(x=><option key={x}>{x}</option>)}</select></div><div className="demo-notice"><BrandSymbol size={15}/> Demo listings are illustrative sample content, not active employer vacancies.</div></section><section className="container market-content"><div className="market-summary"><b>{filtered.length} opportunities</b><span>Sorted by latest</span></div>{filtered.length?<div className="opportunity-grid">{filtered.map(o=><article className="op-card" key={o.id}><div className="op-company"><span className="company-icon">{o.company[0]}</span><span className="op-identity"><small className="op-org-kind">{o.organizationType||'Company'}</small><b>{o.company}</b><small>{o.location}</small></span><span className="op-kind">{o.type.toLowerCase().includes('intern')?'Internship':'Job'}<small>{o.type.replace(/ internship| placement| role/i,'').trim()}</small></span></div><h3>{o.title}</h3><p>{o.description}</p><div className="op-skills">{o.skills.split(', ').map(s=><span key={s}>{s}</span>)}</div><div className="op-foot"><span>Apply by {new Date(o.deadline+'T00:00:00').toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</span>{currentRole==='student'?<button className="button small" disabled={data.applications.includes(o.id)} onClick={()=>setApplying(o)}>{data.applications.includes(o.id)?'Applied':'Apply now'} {!data.applications.includes(o.id)&&<ArrowRight size={14}/>}</button>:<button className="button small" onClick={()=>data.user?flash('Only student accounts can apply.'):flash('Create a student account to apply.')}>View role <ArrowRight size={14}/></button>}</div></article>)}</div>:<div className="panel"><Empty text="No opportunities match your search."/></div>}</section>{!inDashboard&&<SiteFooter/>}{applying&&data.user&&<ApplicationDialog opportunity={applying} student={data.user} onClose={()=>setApplying(null)} onSubmit={details=>{const application:DemoApplication={id:crypto.randomUUID(),opportunityId:applying.id,title:applying.title,company:applying.company,companyEmail:applying.ownerEmail||'',studentName:details.name,studentEmail:details.email,phone:details.phone,education:details.education,resumeLink:details.resumeLink,note:details.note,status:'Submitted',createdAt:new Date().toISOString()};writeDemoApplications([...readDemoApplications(),application]);setData(d=>({...d,applications:[...d.applications,applying.id]}));setApplying(null);flash(`Application submitted to ${applying.company} for review. They can invite you to an exam next.`)}}/>}</div>}

function ApplicationDialog({opportunity,student,onClose,onSubmit}:{opportunity:Opportunity;student:User;onClose:()=>void;onSubmit:(details:{name:string;email:string;phone:string;education:string;resumeLink:string;note:string})=>void}){
 const [name,setName]=useState(student.name);const [email,setEmail]=useState(student.email);const [phone,setPhone]=useState('');const [education,setEducation]=useState('');const [resumeLink,setResumeLink]=useState('');const [note,setNote]=useState('');
 return <div className="application-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="application-dialog" role="dialog" aria-modal="true" aria-labelledby="application-title"><button className="application-close" type="button" aria-label="Close" onClick={onClose}><X size={18}/></button><div className="eyebrow">APPLICATION</div><h2 id="application-title">Apply to {opportunity.company}</h2><p className="application-subtitle">{opportunity.title} · Share your details so the organization can review your application and decide whether to invite you to an exam.</p><form className="auth-form application-form" onSubmit={e=>{e.preventDefault();onSubmit({name:name.trim(),email:email.trim(),phone:phone.trim(),education:education.trim(),resumeLink:resumeLink.trim(),note:note.trim()})}}><label>Full name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Phone number<input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/></label><label>College / current education<input required value={education} onChange={e=>setEducation(e.target.value)} placeholder="e.g. B.Sc. Computer Science, ABC College"/></label><label>Resume link<input type="url" value={resumeLink} onChange={e=>setResumeLink(e.target.value)} placeholder="https://..."/></label><label>Why are you interested?<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="A short note for the reviewer"/></label><div className="application-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button" type="submit">Submit application <ArrowRight size={15}/></button></div></form><p className="tiny-note">This listing is demo content. The application is visible in this browser’s organization demo inbox.</p></section></div>
}

function OrgContent({role,page,data,setData,flash}:{role:Role;page:string;data:AppData;setData:React.Dispatch<React.SetStateAction<AppData>>;flash:(s:string)=>void}){
 const [title,setTitle]=useState('');
 const [type,setType]=useState('Full-time internship');
 const [location,setLocation]=useState('');
 const [skills,setSkills]=useState('');
 const [deadline,setDeadline]=useState('');
 const companyEmail=data.user?.email||'';
 const owned=data.opportunities.filter(o=>o.ownerEmail===companyEmail);
 const applications=readDemoApplications().filter(a=>a.companyEmail===companyEmail||a.company===data.user?.org);
 if(role==='company'){
  if(page==='Applications'||page==='Hiring Pipeline')return <div className="panel"><div className="panel-head"><div><h3>{page==='Applications'?'Applications inbox':'Hiring pipeline'}</h3><p>Review submitted student details and update the application stage.</p></div><BriefcaseBusiness/></div>{applications.length?applications.map(a=><article key={a.id} className="network-card"><div className="network-card-top"><div><b>{a.studentName}</b><span className="network-org">{a.title} · {a.studentEmail} · {a.phone}</span><span className="network-org">{a.education}{a.resumeLink?` · Resume: ${a.resumeLink}`:''}</span>{a.note&&<p className="body-copy">{a.note}</p>}</div><select aria-label={`Status for ${a.studentName}`} value={a.status} onChange={e=>{const next=readDemoApplications().map(x=>x.id===a.id?{...x,status:e.target.value as DemoApplication['status']}:x);writeDemoApplications(next);flash('Application stage updated.')}}>{['Submitted','Reviewing','Exam invited','Offer','Rejected'].map(s=><option key={s}>{s}</option>)}</select></div></article>):<Empty text="No applications yet. Publish a listing and apply to it with a student demo account."/>}<p className="tiny-note">These demo submissions appear in the organization inbox only in this browser. Exam invitations and offers are represented by the application stage.</p></div>;
  if(page==='Opportunities'||page==='Overview')return <div className="content-grid"><div className="panel wide"><div className="panel-head"><div><h3>Manage opportunities</h3><p>Create listings and publish them to the local demo marketplace.</p></div><BriefcaseBusiness/></div><form className="auth-form" onSubmit={e=>{e.preventDefault();if(!title.trim()||!location.trim()||!skills.trim()||!deadline)return;const opportunity:Opportunity={id:crypto.randomUUID(),title:title.trim(),company:data.user?.org||'Your company',organizationType:data.user?.workspaceRole==='college'?'College':'Company',type,location:location.trim(),skills:skills.trim(),deadline,description:`Opportunity at ${data.user?.org||'your company'}.`,ownerEmail:companyEmail,status:'draft'};setData(d=>({...d,opportunities:[opportunity,...d.opportunities]}));setTitle('');setLocation('');setSkills('');setDeadline('');flash('Draft saved. Publish it when it is ready.')}}><label>Opportunity title<input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="e.g. Frontend Engineering Intern"/></label><label>Type<select value={type} onChange={e=>setType(e.target.value)}><option>Full-time internship</option><option>Part-time internship</option><option>Entry-level placement</option><option>Graduate role</option></select></label><label>Location<input value={location} onChange={e=>setLocation(e.target.value)} required placeholder="Remote or city"/></label><label>Skills<input value={skills} onChange={e=>setSkills(e.target.value)} required placeholder="React, TypeScript, CSS"/></label><label>Application deadline<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} required/></label><button className="button small">Save draft</button></form><div className="info-row"><span>Workspace status</span><b>Demo organization</b></div></div><div className="panel"><h3>Your listings</h3>{owned.length?owned.map(o=><div className="op-mini" key={o.id}><b>{o.title}</b><span>{o.type} · {o.location}</span><div className="info-row"><span>{o.status==='published'?'Published':'Draft'}</span>{o.status==='published'?<button className="button small secondary" onClick={()=>setData(d=>({...d,opportunities:d.opportunities.map(x=>x.id===o.id?{...x,status:'draft'}:x)}))}>Unpublish</button>:<button className="button small" onClick={()=>{setData(d=>({...d,opportunities:d.opportunities.map(x=>x.id===o.id?{...x,status:'published'}:x)}));flash('Listing published to the local demo marketplace.')}}>Publish</button>}</div></div>):<Empty text="No listings created yet."/>}<p className="tiny-note">Listings are local to this browser and are not published to the live internet.</p></div></div>;
  if(page==='Company Profile')return <div className="panel"><h3>Company profile</h3><Info label="Company" value={data.user?.org||'Not set'}/><Info label="Contact" value={companyEmail}/><Info label="Listings" value={`${owned.length}`}/><Info label="Applications" value={`${applications.length}`}/><p className="tiny-note">Update company details in Settings.</p></div>;
  return <div className="panel"><h3>{page}</h3><p className="body-copy">Use Student Discovery to search the demo network and Colleges to browse institutions.</p></div>;
 }
 if(role==='college')return <div className="panel"><h3>Institution overview</h3><p className="body-copy">Review students who request a connection with your college. Approving a student gives your organization access to their shared profile.</p><Empty text="Open Students or Companies to browse the SkillBridge network."/></div>;
 return <div className="panel"><h3>{page}</h3><p className="body-copy">Use Student Requests to approve students who want to connect with your company.</p><Empty text="No connected data yet."/></div>;
}




