// constants.js
import data from '../Operation/data.json';
import metaTags from '../Operation/metatags.json';

const { institutionId } = data;
function splitInstitutionId() {
    const parts = institutionId.split(/(\d+)/).filter(Boolean);
    return {
        institution: institutionId,
        institutionpart:parts[0],
        id: parts[1]
    };
}

const result = splitInstitutionId();
const institutionName = result.institutionpart;
const institution = result.institution;
const institutionData = {
    BETA_DOMAIN: data.domain,
    PROD_DOMAIN: data.domain,
    domain:data.domain,
    paymentMethod:data.paymentMethod,
    InstitutionId: institutionId,
    institution: institution,
    index:data.index || "0",
    institutionType: 'ds',
    GTM_ID: metaTags.gtmId,
    bar_integration:data.bar_integration,
    reprintKot:data.reprintKot,
    saveKot:data.saveKot,
    deployment: {
        [`beta-${institutionId}`]: {
            s3Bucket: data.s3BucketName,
            cloudfrontId: data.cloudFrontId
        },
        [institutionId]: {
            s3Bucket: data.s3BucketName,
            cloudfrontId: data.cloudFrontId
        }
    },
    seo: {
        title: metaTags.seo.title,
        description: metaTags.seo.description,
        keywords: metaTags.seo.keywords
    }
};

export default institutionData;
