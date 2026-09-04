import { Page, Card, BlockStack, Text } from "@shopify/polaris";

export default function RehearsalsPage() {
  return (
    <Page title="Rehearsals">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Welcome to the Rehearsals Module
            </Text>

            <Text as="p" variant="bodyMd">
              This module will manage:
            </Text>

            <ul>
              <li>Solo & Duet Entries</li>
              <li>Teacher Assignments</li>
              <li>Teacher Availability</li>
              <li>Parent Availability</li>
              <li>Rehearsal Scheduling</li>
              <li>Apple Calendar Integration</li>
            </ul>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}