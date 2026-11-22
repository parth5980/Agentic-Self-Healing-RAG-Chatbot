import nodemailer from "nodemailer";
import config from "../config/config.js";

// Builds the raw MIME message locally; nothing is sent over SMTP.
const mimeBuilder = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
  newline: "unix",
});

let cached = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (cached.token && Date.now() < cached.expiresAt - 60_000)
    return cached.token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      refresh_token: config.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token error: ${data.error} ${data.error_description || ""}`,
    );
  }

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

// Returns true if Gmail accepted the message, false otherwise.
export const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await mimeBuilder.sendMail({
      from: `"PNX AI" <${config.GOOGLE_USER}>`,
      to,
      subject,
      text,
      html,
    });
    const raw = info.message.toString("base64url");

    const accessToken = await getAccessToken();
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      },
    );
    if (!res.ok)
      throw new Error(`Gmail API ${res.status}: ${await res.text()}`);

    console.log("Email sent to", to);
    return true;
  } catch (error) {
    console.error("Error sending email:", error.message);
    return false;
  }
};

// import nodemailer from "nodemailer";
// import config from "../config/config.js";

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     type: "OAuth2",
//     user: config.GOOGLE_USER,
//     clientId: config.GOOGLE_CLIENT_ID,
//     clientSecret: config.GOOGLE_CLIENT_SECRET,
//     refreshToken: config.GOOGLE_REFRESH_TOKEN,
//   },
// });

// // Verify the connection configuration
// transporter.verify((error, success) => {
//   if (error) {
//     console.error("Error connecting to email server:", error);
//   } else {
//     console.log("Email server is ready to send messages");
//   }
// });

// export const sendEmail = async (to, subject, text, html) => {
//   try {
//     const info = await transporter.sendMail({
//       from: `"PNX AI" <${config.GOOGLE_USER}>`, // sender address
//       to, // list of receivers
//       subject, // Subject line
//       text, // plain text body
//       html, // html body
//     });

//     console.log("Message sent: %s", info.messageId);
//     console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
//   } catch (error) {
//     console.error("Error sending email:", error);
//   }
// };
