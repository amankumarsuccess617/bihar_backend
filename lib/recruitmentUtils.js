import prisma from "./prisma.js";

/**
 * Check if recruitment has expired
 */
export function isRecruitmentExpired(
  recruitment
) {
  if (
    !recruitment ||
    !recruitment.endAt
  ) {
    return false;
  }

  const now = new Date();

  const endDate = new Date(
    recruitment.endAt
  );

  return now > endDate;
}

/**
 * Check if recruitment is accepting applications
 */
export function isRecruitmentAccepting(
  recruitment
) {
  if (
    !recruitment ||
    !recruitment.isActive
  ) {
    return false;
  }

  const now = new Date();

  // not started yet
  if (recruitment.startAt) {

    const startDate =
      new Date(
        recruitment.startAt
      );

    if (now < startDate) {
      return false;
    }
  }

  // expired
  if (
    isRecruitmentExpired(
      recruitment
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Update recruitment expiry
 */
export async function updateRecruitmentExpiry(
  recruitmentId
) {

  const recruitment =
    await prisma.recruitment.findUnique(
      {
        where: {
          id: recruitmentId,
        },
      }
    );

  if (!recruitment) {
    return null;
  }

  const expired =
    isRecruitmentExpired(
      recruitment
    );

  /*
    IMPORTANT FIX

    DO NOT AUTO ENABLE
    RECRUITMENT AGAIN
  */

  const updated =
    await prisma.recruitment.update(
      {
        where: {
          id: recruitmentId,
        },

        data: {

          isExpired:
            expired,

          // auto disable only if expired

          ...(expired
            ? {
                isActive: false,
              }
            : {}),
        },
      }
    );

  /*
    IMPORTANT FIX

    ONLY DISABLE POSTS
    WHEN EXPIRED

    NEVER AUTO ENABLE
    POSTS AGAIN
  */

  if (expired) {

    await prisma.post.updateMany(
      {
        where: {
          recruitmentId,
        },

        data: {
          isActive: false,
        },
      }
    );
  }

  return updated;
}

/**
 * Batch update all recruitments
 */
export async function updateAllRecruitmentsExpiry() {

  const recruitments =
    await prisma.recruitment.findMany();

  const updates =
    recruitments.map(
      async (rec) => {
        return updateRecruitmentExpiry(
          rec.id
        );
      }
    );

  const results =
    await Promise.all(
      updates
    );

  return results;
}

/**
 * Get recruitment status
 */
export function getRecruitmentStatus(
  recruitment
) {

  if (!recruitment) {
    return {
      status: "UNKNOWN",
      label: "Unknown",
    };
  }

  const now =
    new Date();

  // NOT STARTED

  if (
    recruitment.startAt &&
    now <
      new Date(
        recruitment.startAt
      )
  ) {
    return {
      status:
        "NOT_STARTED",

      label:
        "Coming Soon",

      startDate:
        recruitment.startAt,
    };
  }

  // EXPIRED

  if (
    isRecruitmentExpired(
      recruitment
    )
  ) {
    return {
      status:
        "EXPIRED",

      label:
        "Application Closed",

      endDate:
        recruitment.endAt,
    };
  }

  // DISABLED

  if (
    !recruitment.isActive
  ) {
    return {
      status:
        "DISABLED",

      label:
        "Not Available",
    };
  }

  // ACCEPTING

  if (
    isRecruitmentAccepting(
      recruitment
    )
  ) {
    return {
      status:
        "ACCEPTING",

      label:
        "Applications Open",

      endDate:
        recruitment.endAt,
    };
  }

  return {
    status: "UNKNOWN",
    label:
      "Unknown Status",
  };
}

/**
 * Check if recruitment has active posts
 */
export async function hasActivePosts(
  recruitmentId
) {
  const count =
    await prisma.post.count({
      where: {
        recruitmentId,
        isActive: true,
      },
    });

  return count > 0;
}

/**
 * Disable recruitment if no active posts
 */
export async function disableRecruitmentIfNoPostsAsync(
  recruitmentId
) {
  const count =
    await prisma.post.count({
      where: {
        recruitmentId,
        isActive: true,
      },
    });

  if (count === 0) {
    await prisma.recruitment.update({
      where: { id: recruitmentId },
      data: {
        isActive: false,
      },
    });

    return false;
  }

  return true;
}