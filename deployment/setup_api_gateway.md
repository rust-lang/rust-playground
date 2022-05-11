This guide explains how to set up a managed reverse proxy for your playground deployment. The advantage of this is that AWS will manage the SSL certificates for you.

1. Add the AmazonAPIGatewayAdministrator permission to your playground's IAM user
2. Log into your AWS account with the IAM role that manages your playground deployment.
3. Navigate to https://us-west-2.console.aws.amazon.com/apigateway/main/apis
4. Click "Create API"
5. Name your API something reasonable ("Playground")
6. Click "Import" under HTTP API.
7. Paste the contents of `playground_config.json`
8. Create.
9. Create a default stage.

You should now be able to navigate to the URI for your api gateway using https.
