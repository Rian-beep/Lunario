'use client';
import {useSyncExternalStore} from 'react';
import {Moon,Sun} from 'lucide-react';
import {Button} from './ui/button';
import {getUiTheme,setUiTheme,subscribeUiTheme} from '@/lib/ui-theme';
export function useUiTheme(){return useSyncExternalStore(subscribeUiTheme,getUiTheme,()=> 'light' as const);}
export function UiThemeToggle(){
 const theme=useUiTheme(),dark=theme==='dark';
 return <Button variant="ghost" aria-label={`Switch to ${dark?'light':'dark'} mode`} aria-pressed={dark} onClick={()=>setUiTheme(dark?'light':'dark')}>
  {dark?<Sun size={16}/>:<Moon size={16}/>}<span>{dark?'Light':'Dark'}</span>
 </Button>;
}
