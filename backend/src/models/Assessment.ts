import { Schema, model } from "mongoose";
const assessmentSchema=new Schema({studentId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},monthKey:{type:String,required:true},answers:{type:[Boolean],required:true,validate:[(values:boolean[])=>values.length===20,"Exactly 20 answers are required"]},score:{type:Number,required:true,min:0,max:20},band:{type:String,enum:["low","moderate","high","urgent"],required:true},safetyFlag:{type:Boolean,default:false},completedAt:{type:Date,default:Date.now}},{timestamps:true});
assessmentSchema.index({studentId:1,monthKey:1},{unique:true});
export const Assessment=model("Assessment",assessmentSchema);
