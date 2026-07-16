const User = require("../models/User");
const express=require("express");
const router=express.Router();
router.post("/test",(req,res)=>{
    console.log("recived data");
    console.log(req.body);
    const{name,age,blood_group}=req.body;
    if(!name){
        return res.status(400).json({
            success:false,
            message:"Name is requried"
        });}
        if(!age){
            return res.status(400).json({
                success:false,
                messgae:"age is requried"
            });}
            if(!blood_group){
                return res.status(400)({
                    success:false,
                    messgae:"age is requried"
                });}
                res.status(201).json({
                    success:true,
                    message:"user registartion successfull",
                    data:req.body


                })
    
});

router.get("/user/:id",(req,res)=>{
    console.log(req.params);
    res.json({
        success: true,
        userID:req.params.id

    })  
});

router.get("/search",(req,res)=>{
    console.log(req.query);
        res.json({
            success:true,
            filter:req.query
        });
    
    
});
module.exports=router;