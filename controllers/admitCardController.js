import prisma from "../lib/prisma.js";
import { notifyAdmitCardReady } from "../lib/notificationManager.js";
import { generateAdmitCardPdf } from "../lib/generateAdmitCardPdf.js";

function makeRollNo({ recruitmentCode, postCode, seq }) {

  const prefix = process.env.ADMIT_ROLL_PREFIX || "ROLL";

  const n = String(seq).padStart(6, "0");

  return `${prefix}-${recruitmentCode}-${postCode}-${n}`;

}

// ADMIN: GENERATE ADMIT CARDS

export const generateAdmitCardsForPost = async (req, res) => {

  try {

    const postId = Number(req.params.postId);

    const {
      examDate,
      shift,
      centers,
    } = req.body;

    if (
      !examDate ||
      !shift ||
      !Array.isArray(centers) ||
      centers.length === 0
    ) {

      return res.status(400).json({
        message: "examDate, shift, centers[] required",
      });

    }

    const post = await prisma.post.findUnique({

      where: {
        id: postId,
      },

      include: {
        recruitment: true,
      },

    });

    if (!post) {

      return res.status(404).json({
        message: "Post not found",
      });

    }

    // ELIGIBLE APPLICATIONS

    const apps = await prisma.application.findMany({

      where: {

        postId,

        status: {
          in: ["PAYMENT_SUCCESS", "ACCEPTED"],
        },

      },

      orderBy: {
        id: "asc",
      },

      include: {

        admitCard: true,

        user: true,

      },

    });

    let created = 0;

    let skipped = 0;

    const existingCount = await prisma.admitCard.count({

      where: {
        application: {
          postId,
        },
      },

    });

    let seq = existingCount + 1;

    for (let i = 0; i < apps.length; i++) {

      const app = apps[i];

      // SKIP IF ALREADY EXISTS

      if (app.admitCard) {

        skipped++;

        continue;

      }

      const center = centers[created % centers.length];

      const rollNo = makeRollNo({

        recruitmentCode: post.recruitment.code,

        postCode: post.code,

        seq,

      });

      const qrData = JSON.stringify({

        applicationId: app.id,

        applicationNo: app.applicationNo,

        rollNo,

        postId: post.id,

      });

      // GENERATE PDF

    const pdfUrl = await generateAdmitCardPdf({

  name: app.user?.name || "Candidate",

  applicationNo: app.applicationNo,

  rollNo,

  recruitmentTitle: post.recruitment.title,

  postName: post.name,

  examCenter: center,

  examDate: new Date(examDate).toLocaleDateString("en-IN"),

  shift,

});

      // SAVE IN DATABASE

      const savedCard = await prisma.admitCard.create({

        data: {

          applicationId: app.id,

          rollNo,

          examCenter: center,

          examDate: new Date(examDate),

          shift: String(shift),

          qrData,

          pdfUrl,

        },

      });

      // NOTIFICATION

      await notifyAdmitCardReady(app.user, {

        id: savedCard.id,

        rollNumber: rollNo,

        examCenter: center,

        examDate: new Date(examDate),

        shift: String(shift),

        pdfUrl,

      }).catch((err) =>
        console.error("[Admit Card Notification]", err)
      );

      created++;

      seq++;

    }

    return res.json({

      success: true,

      postId,

      totalEligible: apps.length,

      created,

      skipped,

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      message: "Failed to generate admit cards",

      error: error.message,

    });

  }

};

// CANDIDATE: GET MY ADMIT CARDS

export const myAdmitCards = async (req, res) => {

  try {

    const apps = await prisma.application.findMany({

      where: {
        userId: req.user.id,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {

        post: {
          include: {
            recruitment: true,
          },
        },

        admitCard: true,

      },

    });

    const admitCards = apps

      .filter((a) => a.admitCard)

      .map((a) => ({

        applicationId: a.id,

        applicationNo: a.applicationNo,

        recruitment: {

          code: a.post.recruitment.code,

          title: a.post.recruitment.title,

        },

        post: {

          id: a.post.id,

          code: a.post.code,

          name: a.post.name,

        },

        admitCard: {

          id: a.admitCard.id,

          rollNo: a.admitCard.rollNo,

          examCenter: a.admitCard.examCenter,

          examDate: a.admitCard.examDate,

          shift: a.admitCard.shift,

          pdfUrl: a.admitCard.pdfUrl,

          generatedAt: a.admitCard.createdAt,

        },

      }));

    return res.json(admitCards);

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      message: "Failed to fetch admit cards",

    });

  }

};

// ADMIN: GET ADMIT CARDS FOR A SPECIFIC POST
export const getAdmitCardsForPost = async (req, res) => {
  try {
    const postId = Number(req.params.postId);

    const admitCards = await prisma.admitCard.findMany({
      where: {
        application: {
          postId,
        },
      },
      include: {
        application: {
          include: {
            user: true,
            post: {
              include: {
                recruitment: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedCards = admitCards.map((card) => ({
      id: card.id,
      rollNo: card.rollNo,
      applicationId: card.applicationId,
      postId: card.application.postId,
      examCenter: card.examCenter,
      examDate: card.examDate,
      shift: card.shift,
      pdfUrl: card.pdfUrl,
      generatedAt: card.createdAt,
      candidateName: card.application.user?.name || "N/A",
      applicationNo: card.application.applicationNo,
    }));

    return res.json(formattedCards);
  } catch (error) {
    console.error("[Get Admit Cards for Post]", error);
    return res.status(500).json({
      message: "Failed to fetch admit cards for post",
      error: error.message,
    });
  }
};