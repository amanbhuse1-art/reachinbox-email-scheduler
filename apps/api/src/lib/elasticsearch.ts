import { Client } from '@elastic/elasticsearch';

const elasticsearchUrl =
  process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200';

export const elasticsearch = new Client({
  node: elasticsearchUrl,
});

export const EMAIL_INDEX = 'reachinbox-emails';

export type EmailSearchDocument = {
  id: string;
  tenantId: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string;
  createdAt: string;
};

export async function ensureEmailIndex() {
  const exists = await elasticsearch.indices.exists({
    index: EMAIL_INDEX,
  });

  if (!exists) {
    await elasticsearch.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          tenantId: { type: 'keyword' },
          campaignId: { type: 'keyword' },
          senderId: { type: 'keyword' },
          recipient: { type: 'text' },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          createdAt: { type: 'date' },
        },
      },
    });

    console.log(`Elasticsearch index created: ${EMAIL_INDEX}`);
  }
}

export async function indexEmail(
  email: EmailSearchDocument,
) {
  await elasticsearch.index({
    index: EMAIL_INDEX,
    id: email.id,
    document: email,
    refresh: 'wait_for',
  });
}

export async function searchEmails(
  tenantId: string,
  query: string,
) {
  const result = await elasticsearch.search<EmailSearchDocument>({
    index: EMAIL_INDEX,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: [
                'recipient',
                'subject',
                'body',
                'status',
              ],
            },
          },
        ],
        filter: [
          {
            term: {
              tenantId,
            },
          },
        ],
      },
    },
    sort: [
      {
        createdAt: {
          order: 'desc',
        },
      },
    ],
  });

  return result.hits.hits.map((hit) => hit._source);
}