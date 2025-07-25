/* eslint-disable eol-last */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Client, SendEmailV3_1, LibraryResponse } from 'node-mailjet';
import crypto from 'crypto';
import axios from 'axios';

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

const ENCRYPTION_KEY = Buffer.from("TmM0bG9QZ3J2dXhFTk1XcWJqZ1hSOUlScGZqS2JXb3g=", "base64");
const IV_LENGTH = 16;

// FUNCTION FOR ENCRYPTION
function encryptPassword(password:any) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; 
}


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

        const ref1 = await admin.firestore().collection("users").doc(newUser.uid);

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
          openingMessage: snap.get("openingMessage") || '',
          closingMessage: snap.get("closingMessage") || '',
          encryptedPassword  : encryptPassword(snap.get("password")) || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          emailStatus: 'not_sent',
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
            let openingMessage = snap.get("openingMessage") || '';
            let closingMessage = snap.get("closingMessage") || '';

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
                    "var_opening_message": openingMessage,
                    "var_closing_message": closingMessage
                  },
                  // "TemplateID": (snap.get("userRole") == 'project_owner') ? 5893544 : 4774200
                  "TemplateID": 4774200
                },
              ],
            };
          
         try {
             const result: LibraryResponse<SendEmailV3_1.Response> = await mailjet
                     .post('send', { version: 'v3.1' })
                     .request(data);
           
              const status = result.body.Messages[0].Status;

              if (status  === "success") {
              batch.update(ref1, { emailStatus: "sent" });
            }
         } catch (error) {
              console.error("Email sending failed:", error);
         }

                    
        const ref3 = await admin.firestore().collection("users").doc(userId);
        await batch.delete(ref3);
        return batch.commit();
      } catch (error) {
        console.error(error);
        return error;
      }
});

exports.resendUserInvite = functions.https.onCall(async (data, context) => {
  const userId = data.id;

  try {
    const userDoc = await admin.firestore().collection("users").doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found.");
    }

    const snap = userDoc;

    // Get data from the document
    const emailEmail = snap.get("userEmail");
    const emailName = snap.get("userFirstName") + " " + snap.get("userLastName");
    const textSignature = data.textSignature;
    const emailSignature = data.emailSignature
    const emailHeaderNewUser = data.emailHeaderNewUser;
    const accountFirebase = data.accountFirebase;

    const dataToSend = {
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
          Subject: 'Tradies Diary - User Invitation',
          TemplateLanguage: true,
          Variables: {
            var_link: `https://${accountFirebase}.tradiesdiary.com/#/pages/login`,
            var_header: emailHeaderNewUser,
            var_textsignature: textSignature,
            var_signature: emailSignature
          },
          TemplateID: 7031492
        },
      ],
    };

    const result: LibraryResponse<SendEmailV3_1.Response> = await mailjet
      .post('send', { version: 'v3.1' })
      .request(dataToSend);

    const { Status } = result.body.Messages[0];

    console.log("Resend Invite Email Status:", Status);

    return { success: true, status: Status };

  } catch (error) {
    console.error("Error resending invite:", error);
    throw new functions.https.HttpsError("internal", "Failed to resend invite.");
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
  let emailEmail = data.clientEmails;
  let emailOpening = data.openingMessage;
  let emailRates = data.rates;
  let emailTerms = `<ul>${
                    data.termsConditions
                      .split('\n')
                      .filter((line: string) => line.trim())
                      .map((line: string) => `<li>${line.trim()}</li>`)
                      .join('')
                  }</ul>`;
  let emailclosing = data.closingMessage;
  let emailHeader = data.emailHeaderNewUser2;
  let emailLink = data.varLink;
  let textSignature = data.textSignature ? data.textSignature : '';
  let emailSignature = data.emailSignature ? data.emailSignature : '';

  const recipientEmails: string[] = emailEmail
  .split(',')
  .map((e: string) => e.trim())
  .filter((e: any) => e);

  const toRecipients = recipientEmails.map(email => ({
  Email: email,
  Name: emailName
  }));

  const emailData: SendEmailV3_1.Body = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: "Tradies Diary"
        },
        To: toRecipients,
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
  let attachments = data.attachments || [];

  const attachmentObjects = await Promise.all(
    attachments.map(async (url:any) => {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer'
        });

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const fileName = url.split('/').pop()?.split('?')[0] || 'attachment';

        return {
          ContentType: contentType,
          Filename: fileName,
          Base64Content: Buffer.from(response.data).toString('base64')
        };
      } catch (error:any) {
        console.error('Error downloading attachment:', url, error.message);
        return null;
      }
    })
  );

  const validAttachments = attachmentObjects.filter(att => att !== null);

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
        },
        Attachments : validAttachments
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
  let emailBCC = data.bcc ? data.bcc : '';
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
              Bcc : emailBCC,
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
  let emailBCC = data.bcc ? data.bcc : '';
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
              Bcc : emailBCC,
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
  let emailBCC = data.bcc ? data.bcc : '';
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
              Bcc: emailBCC,
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

// Send notification email when a comment is added
exports.sendFBCommentNotification = functions.https.onCall(async (data, context) => {
  const to = data.to || [];
  const subject =
    (data.subjectTitle + ': ' + data.projectName + ' - ' + data.rfiName) ||
    'New Comment Added';
  const commentText = data.commentText || '';
  const commenter = data.author || '';
  const header = data.emailHeader || '';
  const link = data.varLink || '';
  const pdfLink = data.pdfLink || '';

  const toArray = Array.isArray(to) ? to : [to];

  const emailData = {
    Messages: [
      {
        From: {
          Email: 'action@tradiesdiary.com',
          Name: 'Tradies Diary',
        },
        To: toArray.map((email) => ({
          Email: email,
          Name: email,
        })),
        Subject: subject,
        TemplateLanguage: true,
        Variables: {
          var_comment: commentText,
          var_commenter: commenter,
          var_header: header,
          var_link: link,
          var_pdfLink: pdfLink,
        },
        TemplateID: 7173387,
        TemplateErrorReporting: {
          Email: 'cj@spindesign.com.au',
          Name: 'CJ Diary',
        },
      },
    ],
  };

  try {
    const emailResult: any = await mailjet
      .post('send', { version: 'v3.1' })
      .request(emailData);
    const { Status } = emailResult.body.Messages[0];
    console.log('Comment Notification Email Status:', Status);
    return { success: true, status: Status };
  } catch (error) {
    console.error('Error sending comment notification:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send comment notification.'
    );
  }
});

