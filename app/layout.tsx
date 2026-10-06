import type {Metadata} from 'next';import './globals.css';import BottomNav from '@/components/BottomNav';
export const metadata:Metadata={title:'나의 우주 · 사주와 원소의 기록',description:'태어난 날의 사주를 행성, 원소 분신, 관계의 지도로 만나는 공간.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body><div className="site-shell"><main className="page-content">{children}</main><BottomNav/></div></body></html>}
