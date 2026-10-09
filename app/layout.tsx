import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'GapCity · Local business intelligence',description:'Explore local competition, compare public ratings and investigate review-backed research zones in a geographic 3D map.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
