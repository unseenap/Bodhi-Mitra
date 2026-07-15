import webpush from "web-push";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
const enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
export async function saveSubscription(userId:string,subscription:unknown){await User.findByIdAndUpdate(userId,{$addToSet:{pushSubscriptions:subscription}})}
export async function notifyPsychologists(payload:{requestId:string;mode:string}){if(!enabled)return;const users=await User.find({role:"psychologist",verified:true,isActive:true}).select("+pushSubscriptions");await Promise.allSettled(users.flatMap(user=>(user.pushSubscriptions??[]).map((subscription:any)=>webpush.sendNotification(subscription,JSON.stringify({title:"New support request",body:`A student is waiting for ${payload.mode} support.`,url:"/psychologist",tag:payload.requestId}))))) }
