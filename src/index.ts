/* eslint-disable eol-last */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Client, SendEmailV3_1, LibraryResponse } from 'node-mailjet';

admin.initializeApp();
// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  console.log("Hello!");
  response.send("Hello from Firebase Test!");
});

const mailjet = new Client({
  apiKey:  '2a650d8ef563ed5dddcf19fd51f62b43',
  apiSecret: 'a2c5a299186a48aae173d0e6fa33c021'
});

exports.deleteUser = functions.firestore
    .document("users/{userId}")
    .onDelete(async (snap, context) => {
      try {
        const userId = snap.id;
        admin.auth().deleteUser(userId)
          .then(function() {
            console.log("Successfully deleted user");
            return("successfull");
          })
          .catch(function(error) {
            console.log("Error deleting user:", error);
            return error;
          });

      } catch (error) {
        console.error(error);
        return error;
      }
});

exports.createUser = functions.firestore
    .document("users/{userId}")
    .onCreate(async (snap, context) => {
      try {
        const userId = snap.id;
        const batch = admin.firestore().batch();
        const newUser = await admin.auth().createUser({
          disabled: false,
          displayName: snap.get("userFirstName")+ " " +snap.get("userLastName"),
          email: snap.get("userEmail"),
          password: snap.get("password"),
        });

        const ref1 = await
        admin.firestore().collection("users").doc(newUser.uid);

        await batch.set(ref1, {
          id: newUser.uid,
          userEmail: newUser.email,
          userFirstName: snap.get("userFirstName"),
          userLastName: snap.get("userLastName"),
          userRole: snap.get("userRole"),
          userStaffNo: snap.get("userStaffNo"),
          userShowTime: snap.get("userShowTime"),
          userStart: snap.get("userStart"),
          userBreak: snap.get("userBreak"),
          userFinish: snap.get("userFinish"),
          userMobile: snap.get("userMobile"),
          userAccounts: snap.get("userAccounts"),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await admin.auth().setCustomUserClaims(newUser.uid,
            {userRole: snap.get("userRole")});

            let emailEmail = snap.get("userEmail");
            let emailName = snap.get("userFirstName")+ " " +snap.get("userLastName");
            let emailPassword = snap.get("password");
            let emailHeaderNewUser = snap.get("emailHeaderNewUser");
            let accountFirebase = snap.get("accountFirebase");
            let textSignature = snap.get("textSignature") ? snap.get("textSignature") : '';
            let emailSignature =  snap.get("emailSignature") ?  snap.get("emailSignature") : '';

            const data: SendEmailV3_1.Body = {
              Messages: [
                {
                  From: {
                    Email: 'action@tradiesdiary.com',
                    Name: "Tradies Diary"
                  },
                  To: [
                    {
                      Email: emailEmail,
                      Name: emailName
                    },
                  ],
                  Subject: 'Tradies Diary - New User Notification',
                  "TemplateLanguage": true,
                  "Variables": {
                    "var_username": emailEmail,
                    "var_password":emailPassword,
                    "var_link": "https://"+accountFirebase+".tradiesdiary.com/#/pages/login",
                    "var_header": emailHeaderNewUser,
                    "var_textsignature": textSignature,
                    "var_signature": emailSignature,
                  },
                  "TemplateID": (snap.get("userRole") == 'project_owner') ? 5893544 : 4774200
                },
              ],
            };
          
            const result: LibraryResponse<SendEmailV3_1.Response> = await mailjet
                    .post('send', { version: 'v3.1' })
                    .request(data);
          
            const { Status } = result.body.Messages[0];

            console.log(Status);

        const ref3 = await admin.firestore().collection("users").doc(userId);
        await batch.delete(ref3);
        return batch.commit();
      } catch (error) {
        console.error(error);
        return error;
      }
});

exports.updateUser = functions.firestore
    .document("users/{userId}")
    .onUpdate(async (change, context) => {
      try {
        
        const userId = change.after.id
        // ...the new value after this update
        const newValue = change.after.data()||{};

        // ...the previous value before this update
        const previousValue = change.before.data()||{};

        const fieldValue = admin.firestore.FieldValue; 

        if (newValue.password) {

          await admin.auth().updateUser(userId,
            {
              disabled: false,
              password: newValue.password
            });
            
          const ref = admin.firestore().collection("users").doc(userId);
          await ref.update({ password: fieldValue.delete() }); 
          await ref.update({ confirm_password: fieldValue.delete() }); 
        }else{
        
          await admin.auth().updateUser(userId,
            {
              disabled: false,
              displayName: newValue.userFirstName+ " " +newValue.userLastName,
              email: newValue.userEmail
            });

        }

        if (newValue.userRole != previousValue.userRole) {
          await admin.auth().setCustomUserClaims(userId,
          {
            userRole: newValue.userRole
          });
        }

      } catch (error) {
        console.error(error);
        return error;
      }
});    

//Creating a Firebase Cloud Function
exports.sendFBClientProjectRequest = functions.https.onCall(async (data, context) => {
  console.log(data);

  let emailName = data.clientName;
  let emailEmail = data.clientEmail;
  let emailOpening = data.openingMessage;
  let emailRates = data.rates;
  let emailTerms = data.termsConditions;
  let emailclosing = data.closingMessage;
  let emailHeader = data.emailHeaderNewUser2;
  let emailLink = data.varLink;
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';

  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: [
          {
            Email: emailEmail,
            Name: emailName
          },
        ],
        Subject: 'Project Client Request',
        "TemplateLanguage": true,
        "Variables": {
          "var_client_name": emailName,
          "var_opening_message": emailOpening,
          "var_rates": emailRates,
          "var_terms_condition": emailTerms,
          "var_closing_message": emailclosing,
          "var_link": emailLink,
          "var_header": emailHeader,
          "var_textsignature": textSignature,
          "var_signature": emailSignature,
        },
        "TemplateID": 4777916
      },
    ],
  };

  const emailResult: LibraryResponse<SendEmailV3_1.Response> = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);

  const { Status } = emailResult.body.Messages[0];

  console.log(Status);
  return Status;
});

//Creating a Firebase Cloud Function
exports.sendFBAdminProjectRequest = functions.https.onCall(async (data, context) => {
  console.log(data);

  let emailName = data.clientName ? data.clientName : '';
  let company = data.company ? data.company : '';
  let individual = data.individual ? data.individual : '';
  let abn = data.abn ? data.abn : '';
  let siteAddress = data.siteAddress ? data.siteAddress : '';
  let siteName = data.siteName ? data.siteName : '';
  let contactNumber = data.contactNumber ? data.contactNumber : '';
  let contactEmail = data.contactEmail ? data.contactEmail : '';
  let sendInvoicesTo = data.sendInvoicesTo ? data.sendInvoicesTo : '';
  let urgency = data.urgency ? data.urgency : '';
  let descriptionWorks = data.descriptionWorks ? data.descriptionWorks : '';
  let rates = data.rates ? data.rates : '';
  let agree = data.agree ? data.agree : '';

  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailHeader = data.emailHeaderNewUser2 ? data.emailHeaderNewUser2 : '';
  let emailLink = data.varLink ? data.varLink : '';

  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';

  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: [
          {
            Email: emailEmail,
            Name: emailName
          },
        ],
        Subject: 'New Project Request Submitted',
        "TemplateLanguage": true,
        "Variables": {
          "var_client_name": emailName,
          "var_company": company,
          "var_individual": individual,
          "var_abn": abn,
          "var_site_address": siteAddress,
          "var_siteName": siteName,
          "var_contactNumber": contactNumber,
          "var_contactEmail": contactEmail,
          "var_sendInvoicesTo": sendInvoicesTo,
          "var_urgency": urgency,
          "var_descriptionWorks": descriptionWorks,
          "var_rates": rates,
          "var_agree": agree,
          "var_emailLink": emailLink,
          "var_header": emailHeader,
          "var_textsignature": textSignature,
          "var_signature": emailSignature
        },
        "TemplateID": 4788239,
        "TemplateErrorReporting": {
          "Email": 'cj@spindesign.com.au',
          "Name": 'CJ Diary',
        }
      },
    ],
  };

  const emailResult: LibraryResponse<SendEmailV3_1.Response> = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);

  const { Status } = emailResult.body.Messages[0];

  console.log(Status);
  return Status;
});

//Creating a Firebase Cloud Function
exports.sendFBClientWeeklyReport = functions.https.onCall(async (data, context) => {
  console.log(data);

  let emailBody = data.body ? data.body : ''; 
  let emailEmail = data.to ? data.to : '';
  let emailCC = data.cc ? data.cc : '';
  let emailBCC = data.bcc ? data.bcc : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.pdfLink ? data.pdfLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let formattedDate = data.formattedDate ? data.formattedDate : '';

  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: emailEmail,
        Cc: emailCC,
        Bcc: emailBCC,
        Subject: 'New Weekly Report Submitted - '+projectName+' - '+formattedDate,
        "TemplateLanguage": true,
        "Variables": {
          "var_link": emailLink,
          "var_header": emailHeader,
          "var_body": emailBody,
          "var_textsignature": textSignature,
          "var_signature": emailSignature,
        },
        "TemplateID": 5176176,
        "TemplateErrorReporting": {
          "Email": 'cj@spindesign.com.au',
          "Name": 'CJ Diary',
        }
      },
    ],
  };

  const emailResult: LibraryResponse<SendEmailV3_1.Response> = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);

  const { Status } = emailResult.body.Messages[0];

  console.log(Status);
  return Status;
});

//Creating a Firebase Cloud Function
exports.sendFBAdminWeeklyReport = functions.https.onCall(async (data, context) => {
  console.log(data);

  let emailBody = data.body ? data.body : ''; 
  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailCC = data.cc ? data.cc : '';
  let emailBCC = data.bcc ? data.bcc : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.pdfLink ? data.pdfLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let formattedDate = data.formattedDate ? data.formattedDate : '';

  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: [
          {
            Email: emailEmail,
          },
        ],
        Cc: emailCC,
        Bcc: emailBCC,
        Subject: 'New Weekly Report Submitted for Approval - '+projectName+' - '+formattedDate,
        "TemplateLanguage": true,
        "Variables": {
          "var_link": emailLink,
          "var_header": emailHeader,
          "var_body": emailBody,
          "var_textsignature": textSignature,
          "var_signature": emailSignature,
        },
        "TemplateID": 5176176,
        "TemplateErrorReporting": {
          "Email": 'cj@spindesign.com.au',
          "Name": 'CJ Diary',
        }
      },
    ],
  };

  const emailResult: LibraryResponse<SendEmailV3_1.Response> = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);

  const { Status } = emailResult.body.Messages[0];

  console.log(Status);
  return Status;
});

//Creating a Firebase Cloud Function
exports.sendFBVariationsRequest = functions.https.onCall(async (data, context) => {
  let emailOpeningMessage = data.openingMessage ? data.openingMessage : '';
  let emailClosingMessage = data.closingMessage ? data.closingMessage : '';
  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailCC = data.cc ? data.cc : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.varLink ? data.varLink : '';
  let pdfLink = data.pdfLink ? data.pdfLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let variationName = data.variationName ? data.variationName : '';
  let subjectTitle = data.subjectTitle ? data.subjectTitle : '';
  const emailData = {
      Messages: [
          {
              From: {
                  Email: 'action@tradiesdiary.com',
                  Name: "Tradies Diary"
              },
              To: emailEmail,
              Cc: emailCC,
              Subject: subjectTitle + ': ' + projectName + ' - ' + variationName,
              "TemplateLanguage": true,
              "Variables": {
                  "var_link": emailLink,
                  "var_pdfLink": pdfLink,
                  "var_header": emailHeader,
                  "var_opening": emailOpeningMessage,
                  "var_closing": emailClosingMessage,
                  "var_textsignature": textSignature,
                  "var_signature": emailSignature,
              },
              "TemplateID": 5392872,
              "TemplateErrorReporting": {
                  "Email": 'cj@spindesign.com.au',
                  "Name": 'CJ Diary',
              }
          },
      ],
  };
  const emailResult:any = await mailjet
      .post('send', { version: 'v3.1' })
      .request(emailData);
  const { Status } = emailResult.body.Messages[0];
  console.log(Status);
  return Status;
});

//Creating a Firebase Cloud Function
exports.sendFBVariationsSubmit = functions.https.onCall(async (data, context) => {

  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.varLink ? data.varLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let variationName = data.variationName ? data.variationName : '';


  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: emailEmail,
        Subject: 'Admin Variation Notification: '+projectName+' - '+variationName,
        "TemplateLanguage": true,
        "Variables": {
          "var_link": emailLink,
          "var_header": emailHeader,
          "var_textsignature": textSignature,
          "var_signature": emailSignature,
        },
        "TemplateID": 5759488,
        "TemplateErrorReporting": {
          "Email": 'cj@spindesign.com.au',
          "Name": 'CJ Diary',
        }
      },
    ],
  };

  const emailResult: LibraryResponse<SendEmailV3_1.Response> = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);

  const { Status } = emailResult.body.Messages[0];

  console.log(Status);
  return Status;
});

// sednfbselectionrequest

exports.sendFBSelectionsRequest = functions.https.onCall(async (data, context) => {
  let emailOpeningMessage = data.openingMessage ? data.openingMessage : '';
  let emailClosingMessage = data.closingMessage ? data.closingMessage : '';
  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailCC = data.cc ? data.cc : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.varLink ? data.varLink : '';
  let pdfLink = data.pdfLink ? data.pdfLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let selectionName = data.selectionName ? data.selectionName : '';
  let subjectTitle = data.subjectTitle ? data.subjectTitle : '';
  const emailData = {
      Messages: [
          {
              From: {
                  Email: 'action@tradiesdiary.com',
                  Name: "Tradies Diary"
              },
              To: emailEmail,
              Cc: emailCC,
              Subject: subjectTitle + ': ' + projectName + ' - ' + selectionName,
              "TemplateLanguage": true,
              "Variables": {
                  "var_link": emailLink,
                  "var_pdfLink": pdfLink,
                  "var_header": emailHeader,
                  "var_opening": emailOpeningMessage,
                  "var_closing": emailClosingMessage,
                  "var_textsignature": textSignature,
                  "var_signature": emailSignature,
              },
              "TemplateID": 6752177,
              "TemplateErrorReporting": {
                  "Email": 'cj@spindesign.com.au',
                  "Name": 'CJ Diary',
              }
          },
      ],
  };
  const emailResult:any = await mailjet
      .post('send', { version: 'v3.1' })
      .request(emailData);
  const { Status } = emailResult.body.Messages[0];
  console.log(Status);
  return Status;
});


 // sendfbrfirequest
exports.sendFBRFIsRequest = functions.https.onCall(async (data, context) => {
  let emailOpeningMessage = data.openingMessage ? data.openingMessage : '';
  let emailClosingMessage = data.closingMessage ? data.closingMessage : '';
  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailCC = data.cc ? data.cc : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.varLink ? data.varLink : '';
  let pdfLink = data.pdfLink ? data.pdfLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let rfiName = data.rfiName ? data.rfiName : '';
  let subjectTitle = data.subjectTitle ? data.subjectTitle : '';
  const emailData = {
      Messages: [
          {
              From: {
                  Email: 'action@tradiesdiary.com',
                  Name: "Tradies Diary"
              },
              To: emailEmail,
              Cc: emailCC,
              Subject: subjectTitle + ': ' + projectName + ' - ' + rfiName,
              "TemplateLanguage": true,
              "Variables": {
                  "var_link": emailLink,
                  "var_pdfLink": pdfLink,
                  "var_header": emailHeader,
                  "var_opening": emailOpeningMessage,
                  "var_closing": emailClosingMessage,
                  "var_textsignature": textSignature,
                  "var_signature": emailSignature,
              },
              "TemplateID": 6752278,
              "TemplateErrorReporting": {
                  "Email": 'cj@spindesign.com.au',
                  "Name": 'CJ Diary',
              }
          },
      ],
  };
  const emailResult:any = await mailjet
      .post('send', { version: 'v3.1' })
      .request(emailData);
  const { Status } = emailResult.body.Messages[0];
  console.log(Status);
  return Status;
});

// SEND EMAIL AFTER SUBMIT SELECTIONS
exports.sendFBSelectionsSubmit = functions.https.onCall(async (data, context)  => {
  // console.log(data);

  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.selLink ? data.selLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let selectionName = data.selectionName ? data.selectionName : '';


  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: emailEmail,
        Subject: 'Admin Selection Notification: '+projectName+' - '+selectionName,
        "TemplateLanguage": true,
        "Variables": {
          "var_link": emailLink,
          "var_header": emailHeader,
          "var_textsignature": textSignature,
          "var_signature": emailSignature,
        },
        "TemplateID": 6752378,
        "TemplateErrorReporting": {
          "Email": 'cj@spindesign.com.au',
          "Name": 'CJ Diary',
        }
      },
    ],
  };

  const emailResult: LibraryResponse<SendEmailV3_1.Response> = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);

  const { Status } = emailResult.body.Messages[0];

  console.log(Status);
  return Status;
});

// SEND EMAIL AFTER SUBMIT RFI
exports.sendFBRFIsSubmit = functions.https.onCall(async (data, context) => {
  // console.log(data);

  let emailEmail = data.adminEmail ? data.adminEmail : '';
  let emailHeader = data.emailHeader ? data.emailHeader : '';
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';
  let emailLink = data.rfiLink ? data.rfiLink : '';
  let projectName = data.projectName ? data.projectName : '';
  let rfiName = data.rfiName ? data.rfiName : '';


  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: emailEmail,
        Subject: 'Admin RFI Notification: '+projectName+' - '+rfiName,
        "TemplateLanguage": true,
        "Variables": {
          "var_link": emailLink,
          "var_header": emailHeader,
          "var_textsignature": textSignature,
          "var_signature": emailSignature,
        },
        "TemplateID": 6752519,
        "TemplateErrorReporting": {
          "Email": 'cj@spindesign.com.au',
          "Name": 'CJ Diary',
        }
      },
    ],
  };

  const emailResult: LibraryResponse<SendEmailV3_1.Response> = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);

  const { Status } = emailResult.body.Messages[0];

  // console.log(Status);
  return Status;
});
