// Temporary, read-only lookup for the owner's named deposit correction request.
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
const db = new PrismaClient({adapter: new PrismaNeonHTTP(process.env.DATABASE_URL,{})});
try {
 const users=await db.user.findMany({where:{name:{equals:'Darrel Hill',mode:'insensitive'}},select:{id:true,email:true,name:true,balanceCents:true,updatedAt:true,status:true,walletFrozen:true,payments:{where:{purpose:'WALLET_TOPUP'},select:{id:true,amountCents:true,status:true,receivedAmount:true,confirmedAt:true},orderBy:{createdAt:'desc'},take:10},walletJournal:{select:{id:true,kind:true,paymentId:true,userDeltaCents:true,lockedDeltaCents:true},orderBy:{createdAt:'desc'},take:20}}});
 console.log('CORRECTION_LOOKUP '+JSON.stringify(users));
} catch {console.error('Named correction lookup failed; details withheld.');process.exitCode=1;} finally {await db.$disconnect();}
