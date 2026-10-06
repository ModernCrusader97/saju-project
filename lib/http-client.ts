import type {FortuneResult,GuinMapData,GuinPerson} from './saju/types';
export interface HostedApiResponse {success?:boolean;error?:string;fortune?:FortuneResult;fortunes?:FortuneResult[];guinMap?:GuinMapData;newPerson?:GuinPerson;reply?:string;chats?:Array<{role:'user'|'doryeong';content:string;createdAt:string}>;}
export async function readApiResponse(response:Response):Promise<HostedApiResponse>{
 const value:unknown=await response.json();
 if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('서버 응답 형식을 확인할 수 없습니다.');
 const data=value as HostedApiResponse;
 if(data.error!==undefined&&typeof data.error!=='string')throw new Error('서버 응답 형식을 확인할 수 없습니다.');
 return data;
}
