const router = require('express').Router();
const User = require('../../models/User');
const PasswordResetToken = require('../../models/PasswordResetToken');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");
const { makeNextError } = require("../../public/js/utils");

router.get("/request_reset", (req, res) => {
    res.render("forms/formContainer", {form: 'requestPassResetForm.ejs'})
})

router.post("/request_reset", async (req, res) => {
    const email = req.body.email;
    const user = await User.findOne({email: email});
    if (!user){
        req.flash("error", "An account with that email was not found.")
        res.redirect("request_reset");
        return;
    }
    if (user.isExternalAccount()){
      req.flash("error", `This website cannot reset the password associated with an external account. Reset your password via ${user.getExternalProviderName()}!`)
      res.redirect("request_reset");
      return;
    }
    const jwt_secret = process.env.JWT_SECRET;
    const token = jwt.sign(
        {
          userId: user._id,
          username: user.username
        },
        jwt_secret,
        {
          expiresIn: '1h',
        }
    );
    await PasswordResetToken.deleteOne({userId: user._id}).then(async() => {
      await PasswordResetToken.create({
        userId: user._id,
        token: token,
      });
    });
    
    // send email out
    const website_email = 'yoangelo.website@gmail.com';
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: website_email,
        pass: process.env.WEBSITE_EMAIL_PASS
      }
    });;
    const mailOptions = {
        from: website_email,
        to: user.email,
        subject: "Password Reset Request",
        text: `Hi ${user.username},\n\nPlease click the following link to reset your password:\n\nhttp://${req.headers.host}/auth/password/reset/${token}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, please ignore this email.\n`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          req.flash("error", "There was an error sending the email. Sorry!")
          res.redirect("request_reset");
          return;
        } else {
        console.log("Email sent: " + info.response);
        req.flash("success", `Email has been successfully sent to ${user.email}!`)
        res.redirect("request_reset");
        return;
        }
    });
})

router.get("/reset/:token", async(req, res, next) => {
    const token = req.params.token;
    const jwt_secret = process.env.JWT_SECRET;
    jwt.verify(token, jwt_secret, async (err, decoded) => {
      if (err) {
        return makeNextError('Invalid or Expired Reset Token', 400, next);
      }
      const resetToken = await PasswordResetToken.findOne({
        userId: decoded.userId,
        token: token,
      });
      if (!resetToken) {
        return makeNextError('Invalid or Expired Reset Token', 400, next);
      }
      res.locals.userId = decoded.userId;
      res.locals.token = token;
      res.locals.username = decoded.username;
      res.render('forms/formContainer', { form: 'resetPassForm'});
    });
});

router.post("/reset", async(req, res, next) => {
    const { password, token, userId } = req.body;
    const resetToken = await PasswordResetToken.findOne({
        token: token,
    });
    if (!resetToken) {
      return makeNextError('Invalid or Expired Reset Token', 400, next);
    }
    try {
        const user = await User.findById(userId);
        if (!user) {
          return makeNextError('Error finding your data', 400, next);
        }
        user.setPassword(password, async (err) => {
          if (err) {
            return next(err);
          } else {
            await user.save();
          }
        });
        } catch (err) {
            return next(err);
    }
    await resetToken.deleteOne();
    req.flash('success', 'Password successfully reset');
    res.redirect('/auth/login');
});


module.exports = router;