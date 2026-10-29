import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandSymbol } from './Branding';

type Props={mode:'login'|'register'|'page';workspace?:boolean};

export default function SiteNavbar({mode,workspace=false}:Props){
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(!open)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
    window.addEventListener('keydown',onKeyDown);
    return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',onKeyDown)};
  },[open]);
  const close=()=>setOpen(false);
  return <>
    <header className="auth-site-nav">
      <Link to="/" className="brand" aria-label="SkillBridge home"><span className="brand-icon"><BrandSymbol size={20}/></span><span>skill<span className="brand-light">bridge</span></span></Link>
      <nav className="auth-site-links" aria-label="Main navigation">
        <Link to="/">Home</Link><Link to="/about">About us</Link><Link to="/opportunities">Opportunities</Link><Link to="/our-story">Our story</Link><Link to="/blog">Blog</Link><Link to="/contact">Contact us</Link><Link to="/login" className={mode==='login'?'current':''}>Log in</Link><Link to={workspace?'/app':'/register'} className={`auth-nav-cta ${mode==='register'?'current':''}`}>{workspace?'My workspace':'Get started'}<ArrowRight size={15}/></Link>
      </nav>
      <button type="button" className="auth-menu-toggle" aria-label="Open menu" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={20}/></button>
    </header>
    {open&&createPortal(<div className="responsive-mobile-menu auth-mobile-menu" role="dialog" aria-modal="true" aria-label="Main menu">
      <div className="responsive-mobile-menu-head"><Link to="/" className="brand" aria-label="SkillBridge home" onClick={close}><span className="brand-icon"><BrandSymbol size={19}/></span><span>skill<span className="brand-light">bridge</span></span></Link><button className="responsive-menu-close" aria-label="Close menu" onClick={close}><X size={22}/></button></div>
      <nav className="responsive-mobile-nav" aria-label="Mobile navigation">
        <Link to="/" onClick={close}>Home</Link><Link to="/about" onClick={close}>About us</Link><Link to="/opportunities" onClick={close}>Opportunities</Link><Link to="/our-story" onClick={close}>Our story</Link><Link to="/blog" onClick={close}>Blog</Link><Link to="/contact" onClick={close}>Contact us</Link><Link to="/login" onClick={close}>Log in</Link><Link to={workspace?'/app':'/register'} className="responsive-nav-cta" onClick={close}>{workspace?'My workspace':'Get started'}<ArrowRight size={16}/></Link>
      </nav>
    </div>,document.body)}
  </>;
}
