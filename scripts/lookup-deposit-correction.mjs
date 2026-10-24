// One-time, fixed $500 correction explicitly requested by the owner. Remove after verification.
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
const db = new PrismaClient({adapter: new PrismaNeonHTTP(process.env.DATABASE_URL,{})});
try {
 const users=await db.user.findMany({where:{AND:[{name:{contains:'dar',mode:'insensitive'}},{name:{contains:'hill',mode:'insensitive'}}]},select:{id:true,email:true,name:true,balanceCents:true,updatedAt:true,status:true,walletFrozen:true,payments:{where:{purpose:'WALLET_TOPUP'},select:{id:true,amountCents:true,status:true,receivedAmount:true,confirmedAt:true,currency:true},orderBy:{createdAt:'desc'},take:10},walletJournal:{select:{id:true,kind:true,paymentId:true,userDeltaCents:true,lockedDeltaCents:true},orderBy:{createdAt:'desc'},take:20}},take:10});
 if(process.env.CORRECTION_OPERATION==='apply') {
   const u=users[0],pid=process.env.EXPECTED_PAYMENT_ID;
   if(users.length!==1 || !/^darrell? hill$/i.test(u.name?.trim()??'') || u.id!==process.env.EXPECTED_USER_ID || u.balanceCents!==Number(process.env.EXPECTED_BALANCE_CENTS) || u.updatedAt.toISOString()!==process.env.EXPECTED_UPDATED_AT || u.status!=='ACTIVE' || u.walletFrozen) throw Error('guard');
   const p=u.payments.find(p=>p.id===pid);
   if(!p || p.status!=='CONFIRMED' || p.amountCents!==50000 || Number(p.receivedAmount)!==500 || u.payments.filter(p=>p.status==='CONFIRMED').length!==1)throw Error('guard');
   const credits=await db.walletJournal.aggregate({where:{userId:u.id,userDeltaCents:{gt:0}},_sum:{userDeltaCents:true}});
   const operationId='06a5d020-2b32-4b04-bd6b-c9f3d4bedba3',key='adjustment:'+operationId;
   const prior=await db.walletJournal.findUnique({where:{operationKey:key}});
   if(prior){if(prior.userId!==u.id || prior.paymentId!==pid || prior.userDeltaCents!==50000)throw Error('guard');console.log('CORRECTION_ALREADY_RECORDED '+JSON.stringify({userId:u.id,operationKey:key}));}
   else {
     if(credits._sum.userDeltaCents!==50000)throw Error('guard');
     const owners=await db.user.findMany({where:{role:'SUPER_ADMIN',status:'ACTIVE'},select:{id:true,passwordHash:true}});if(owners.length!==1)throw Error('guard');
     const reason=`Owner confirmed receipt of 1,000 ${p.currency} against a 500 ${p.currency} deposit request. Owner explicitly authorized an additional USD 500 credit to Darrel Hill. Original receipt retained. Executed through protected maintenance workflow: ${process.env.CORRECTION_RUN_URL}`;
     const r=await db.$queryRaw`SELECT wallet_admin_adjust_credit(${owners[0].id},${u.id},${50000},${reason},${u.updatedAt}::timestamp,${u.balanceCents},${operationId},${pid},${owners[0].passwordHash}) AS result`;
     if(!['saved','already_saved'].includes(r[0]?.result))throw Error('guard');
     const after=await db.user.findUniqueOrThrow({where:{id:u.id},select:{balanceCents:true}});
     const note=await db.crmNote.count({where:{id:key,subjectId:u.id,authorId:owners[0].id}}),audit=await db.auditLog.count({where:{id:key,target:u.id,action:'admin.wallet_adjusted'}});
     const reconciliation=await db.$queryRaw`SELECT COALESCE(sum("userDeltaCents"),0)::int AS balance FROM "WalletJournal" WHERE "userId"=${u.id}`;
     if(after.balanceCents!==u.balanceCents+50000 || after.balanceCents!==reconciliation[0].balance || note!==1 || audit!==1)throw Error('verification');
     console.log('CORRECTION_APPLIED '+JSON.stringify({userId:u.id,paymentId:pid,deltaCents:50000,beforeCents:u.balanceCents,afterCents:after.balanceCents,operationKey:key,internalNote:true,audit:true,reconciled:true}));
   }
 } else console.log('CORRECTION_LOOKUP '+JSON.stringify(users));
} catch {console.error('Named correction lookup failed; details withheld.');process.exitCode=1;} finally {await db.$disconnect();}
