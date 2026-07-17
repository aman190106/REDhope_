const user=require("../models/user");
const registerUser = async(req,res)=>{
    try {
      
        // validation of user
        const {name,age,email,password,phone,bloodgroup}=req.body;
        if(!name||!age||!email||!password||!phone||!bloodgroup){
            return res.status(400).json({
                message:"all feilds are required"
            });
        }
          //validatiang mail id means it will check there exist
        const euser=await user.findOne({email});
        if(euser){
            return res.status(400).json({
                success:false,
                message:"mail id already exist"
            });
        }
        const newuser=await user.create({
            name,
            age,
            email,
            password,
            phone,
            bloodgroup
        });
        return res.status(201).json({
            success: true,
            message:"user Registration",
            data:newuser
        });
        
    }
    catch(error){
        console.log(error);
        res.status(500).json({
            success:false,
            message:"internal server error"
        });
    }
};
  module.exports={
    registerUser
  };