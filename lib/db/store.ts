import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import type {FortuneResult,GuinMapData,GuinPerson} from '../saju/types';
export class DataStoreError extends Error {constructor(message:string,public status=503){super(message);this.name='DataStoreError';}}
async function context(){
 const user=await getChatGPTUser();
 if(!user)throw new DataStoreError('ChatGPT 로그인 후 다시 열어주세요.',401);
 if(!env.DB)throw new DataStoreError('테스트 저장소를 잠시 사용할 수 없습니다. 입력을 보존하고 다시 시도해주세요.');
 return {owner:user.userId,db:env.DB};
}
async function save(table:'fortunes'|'guin_maps',value:FortuneResult|GuinMapData){
 const {owner,db}=await context();
 const createdAt='createdAt' in value?String(value.createdAt):new Date().toISOString();
 await db.prepare(`INSERT INTO ${table} (id,owner_id,created_at,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE owner_id=excluded.owner_id`).bind(value.id,owner,createdAt,JSON.stringify(value)).run();
}
async function get<T>(table:'fortunes'|'guin_maps',id:string):Promise<T|null>{const {owner,db}=await context();const row=await db.prepare(`SELECT data FROM ${table} WHERE id=? AND owner_id=?`).bind(id,owner).first<{data:string}>();return row?JSON.parse(row.data) as T:null;}
export const db={
 saveFortune:(value:FortuneResult)=>save('fortunes',value),
 getFortune:(id:string)=>get<FortuneResult>('fortunes',id),
 async listFortunes():Promise<FortuneResult[]>{const {owner,db}=await context();const r=await db.prepare('SELECT data FROM fortunes WHERE owner_id=? ORDER BY created_at DESC').bind(owner).all<{data:string}>();return r.results.map(x=>JSON.parse(x.data));},
 saveGuinMap:(value:GuinMapData)=>save('guin_maps',value),
 getGuinMap:(id:string)=>get<GuinMapData>('guin_maps',id),
 async addFriendToGuinMap(id:string,friend:GuinPerson):Promise<GuinMapData|null>{const {owner,db}=await context();const row=await db.prepare("UPDATE guin_maps SET data=json_insert(data,'$.guins[#]',json(?)) WHERE id=? AND owner_id=? RETURNING data").bind(JSON.stringify(friend),id,owner).first<{data:string}>();return row?JSON.parse(row.data):null;},
 async getChat(id:string):Promise<Array<{role:'user'|'doryeong';content:string;createdAt:string}>>{const {owner,db}=await context();const rows=await db.prepare('SELECT role,content,created_at AS createdAt FROM chats WHERE fortune_id=? AND owner_id=? ORDER BY sequence').bind(id,owner).all<{role:'user'|'doryeong';content:string;createdAt:string}>();return rows.results;},
 async addChatMessage(id:string,role:'user'|'doryeong',content:string){const {owner,db}=await context();const result=await db.prepare('INSERT INTO chats (owner_id,fortune_id,role,content,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM fortunes WHERE id=? AND owner_id=?)').bind(owner,id,role,content,new Date().toISOString(),id,owner).run();if(result.meta.changes!==1)throw new DataStoreError('사주 결과를 찾을 수 없습니다.',404);},
};
