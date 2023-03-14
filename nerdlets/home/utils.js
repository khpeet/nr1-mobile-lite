module.exports = {
  /** ******* Splash *******/
  mobileEntities: () => {
  // pulls reporting mobile entities
  return `
  {
    actor {
      entitySearch(queryBuilder: {reporting: true, domain: MOBILE}) {
        results {
          nextCursor
          entities {
            ... on MobileApplicationEntityOutline {
              guid
              name
              account {
                id
                name
              }
              domain
              alertSeverity
              reporting
              mobileSummary {
                appLaunchCount
                crashCount
                httpErrorRate
                usersAffectedCount
              }
            }
          }
        }
      }
    }
  }
  `;
},
/** ******* Splash *******/
/** ******* Overview/Drilldowns *******/
mobileData: (account, time, guid) => {
// fetch all unique mobile versions/filters in selected time window
return `
{
  actor {
    account(id: ${account}) {
      mobileVersions: nrql(query: "FROM MobileRequest SELECT count(*) facet appVersion, appVersionId where entityGuid = '${guid}' ${time} LIMIT 15", timeout: 90) {
        results
      }
      mobileFilters: nrql(query: "FROM Mobile SELECT uniques(crashLocation), uniques(crashMessage), uniques(crashException), uniques(countryCode), uniques(device), uniques(osVersion), uniques(sessionId), uniques(deviceUuid) where entityGuid = '${guid}' ${time} LIMIT 500", timeout: 90) {
        results
      }
      mobileExceptionFilters: nrql(query: "FROM MobileHandledException SELECT uniques(exceptionLocation), uniques(exceptionMessage), uniques(exceptionName), uniques(countryCode), uniques(device), uniques(osVersion), uniques(sessionId), uniques(deviceUuid) where entityGuid = '${guid}' ${time} LIMIT 500", timeout: 90) {
        results
      }
      mobileHttpFilters: nrql(query: "FROM MobileRequestError SELECT uniques(requestDomain), uniques(requestUrl), uniques(requestPath), uniques(countryCode), uniques(device), uniques(osVersion), uniques(sessionId), uniques(deviceUuid) where entityGuid = '${guid}' ${time} LIMIT 500", timeout: 90) {
        results
      }
    }
  }
}
`;
},
mobileCrashes: (account, time, guid, filter, version) => {
// fetch crash table data in selected time window
return `
{
  actor {
    account(id: ${account}) {
      crashTypes: nrql(query: "FROM MobileCrash SELECT latest(crashException) as 'Exception', uniqueCount(occurrenceId) as 'count', uniqueCount(deviceUuid) as 'Users Affected', min(timestamp) as 'First', max(timestamp) as 'Last', latest(crashMessage) as 'message' where (entityGuid = '${guid}' ${version}) ${filter} facet crashLocation, appVersion ${time} limit 200", timeout: 90) {
        results
      }
    }
  }
}
`;
},
mobileExceptions: (account, time, guid, filter, version) => {
// fetch exception table data in selected time window
return `
{
  actor {
    account(id: ${account}) {
      exceptionTypes: nrql(query: "FROM MobileHandledException SELECT uniqueCount(handledExceptionUuid) as 'count', uniqueCount(deviceUuid) as 'Users Affected', uniqueCount(appVersion) as 'Versions Affected', latest(exceptionMessage) as 'message', latest(exceptionName) as 'name' where (entityGuid = '${guid}' ${version}) ${filter} facet exceptionLocation ${time} limit 200", timeout: 90) {
        results
      }
    }
  }
}
`;
},
mobileHttpErrors: (account, time, guid, filter, version) => {
// fetch http/network error table data in selected time window
return `
{
  actor {
    account(id: ${account}) {
      httpErrors: nrql(query: "FROM MobileRequestError SELECT uniqueCount(requestUuid) as 'occurrences' where (entityGuid = '${guid}' ${version}) ${filter} facet requestUrl, statusCode, networkError ${time} limit 100", timeout: 90) {
        results
      }
    }
  }
}
`;
},
mobileFingerprint: (account, time, guid, filter, version, location) => {
// fetch crash fingerprint details
return `
{
  actor {
    account(id: ${account}) {
      fingerPrint: nrql(query: "SELECT latest(crashMessage) as 'message', latest(crashFingerprint) as 'fp' FROM MobileCrash where entityGuid = '${guid}' and crashLocation = '${location}' and appVersion = '${version}' ${filter} ${time} limit 100", timeout: 90) {
        results
      }
    }
  }
}
`;
},
exceptionFingerprint: (account, time, guid, filter, location) => {
// fetch exception fingerprint details
return `
{
  actor {
    account(id: ${account}) {
      fingerPrint: nrql(query: "FROM MobileHandledException SELECT latest(exceptionMessage) as 'message', latest(fingerprint) as 'fp' where entityGuid = '${guid}' and exceptionLocation = '${location}' ${filter} ${time} limit 100", timeout: 90) {
        results
      }
    }
  }
}
`;
},
crashOccurrences: (account, time, filter, fp) => {
// fetch crash occurrences in selected time window
return `
{
  actor {
    account(id: ${account}) {
      occurrences: nrql(query: "SELECT latest(appVersion) as 'version', latest(deviceUuid) as 'deviceUuid', latest(appBuild) as 'build', latest(crashLocationClass) as 'crashClass', latest(crashLocationFile) as 'crashFile', latest(crashLocationLineNumber) as 'crashLineNumber', latest(crashLocationMethod) as 'crashMethod', latest(crashMessage) as 'crashMessage', latest(lastInteraction) as 'lastInteraction', latest(architecture) as 'arch', latest(deviceGroup) as 'deviceGroup', latest(deviceManufacturer) as 'deviceManufacturer', latest(deviceModel) as 'deviceModel', latest(deviceName) as 'deviceName', latest(deviceType) as 'deviceType', latest(osBuild) as 'osBuild', latest(osMajorVersion) as 'osMajor', latest(osName) as 'osName', latest(osVersion) as 'osVersion', latest(platform) as 'platform', latest(asn) as 'asn', latest(asnOwner) as 'asnOwner', latest(carrier) as 'carrier', latest(networkStatus) as 'networkStatus', latest(city) as 'city', latest(countryCode) as 'countryCode', latest(regionCode) as 'regionCode', latest(appBuild), latest(appImageUuid) as 'appImageUuid', latest(bundleId) as 'bundleId', latest(diskAvailable) as 'diskAvailable', latest(newRelicVersion) as 'nr_version', latest(sessionId) as 'sessionId', latest(timeSinceLastInteraction) as 'timeSinceLastInteraction', latest(timestamp) as 'timestamp', latest(userImageUuids) as 'userImageUuids' FROM MobileCrash where crashFingerprint = '${fp}' ${filter} facet occurrenceId, crashFingerprint ${time} limit 1000", timeout: 90) {
        results
      }
    }
  }
}
`;
},
exceptionOccurrences: (account, time, filter, fp) => {
// fetch exception occurrences in selected time window
return `
{
  actor {
    account(id: ${account}) {
      occurrences: nrql(query: "SELECT latest(deviceUuid) as 'deviceUuid', latest(appBuild) as 'build', latest(exceptionName) as 'exceptionName', latest(exceptionMessage) as 'exceptionMessage', latest(lastInteraction) as 'lastInteraction', latest(deviceGroup) as 'deviceGroup', latest(deviceManufacturer) as 'deviceManufacturer', latest(deviceModel) as 'deviceModel', latest(device) as 'deviceName', latest(deviceType) as 'deviceType', latest(osBuild) as 'osBuild', latest(osMajorVersion) as 'osMajor', latest(osName) as 'osName', latest(osVersion) as 'osVersion', latest(platform) as 'platform', latest(asn) as 'asn', latest(asnOwner) as 'asnOwner', latest(carrier) as 'carrier', latest(city) as 'city', latest(countryCode) as 'countryCode', latest(regionCode) as 'regionCode', latest(newRelicVersion) as 'nr_version', latest(sessionId) as 'sessionId', latest(timestamp) as 'timestamp' FROM MobileHandledException where fingerprint = '${fp}' ${filter} facet handledExceptionUuid, fingerprint ${time} limit 1000", timeout: 90) {
        results
      }
    }
  }
}
`;
},
errorOccurrences: (account, occ, sum) => {
// fetch exception occurrences in selected time window
return `
{
  actor {
    account(id: ${account}) {
      occurrences: nrql(query: "${occ}", timeout: 90) {
        results
      }
      summary: nrql(query: "${sum}", timeout: 90) {
        results
      }
    }
  }
}
`;
},
interactionTrail: (account, time, filter, o) => {
// fetch interaction trail of current crash occurrence
return `
{
  actor {
    account(id: ${account}) {
      interactionTrail: nrql(query: "FROM Mobile SELECT latest(interactionHistory) where occurrenceId = '${o}' ${filter} ${time}", timeout: 90) {
        results
      }
    }
  }
}
`;
},
stackTrace: (guid, o) => {
// fetch stack trace of current crash occurrence
return `
{
  actor {
    entity(guid: "${guid}") {
      ... on MobileApplicationEntity {
        guid
        name
        crash(occurrenceId: "${o}") {
          stackTrace {
            frames {
              filepath
              formatted
              line
              name
            }
          }
        }
      }
    }
  }
}
`;
},
exceptionStackTrace: (guid, o) => {
// fetch stack trace of current exception occurrence
return `
{
  actor {
    entity(guid: "${guid}") {
      ... on MobileApplicationEntity {
        guid
        name
        exception(occurrenceId: "${o}") {
          stackTrace {
            frames {
              filepath
              formatted
              line
              name
            }
          }
        }
      }
    }
  }
}
`;
},
eventTrail: (account, guid, time, filter, sessionId) => {
// fetch all events for current crash occurrence
return `
{
  actor {
    account(id: ${account}) {
      requests: nrql(query: "FROM MobileRequest SELECT latest(statusCode) as 'statusCode', latest(traceId) as 'traceId', latest(responseTime) as 'responseTime', latest(requestMethod) as 'requestMethod', latest(requestUuid) as 'requestUuid', latest(bytesSent) as 'bytesSent', latest(bytesReceived) as 'bytesReceived', latest(connectionType) as 'connectionType', latest(duration) as 'duration', latest(requestFingerprint) as 'requestFingerprint', latest(requestUrl) as 'requestUrl', latest(requestDomain) as 'requestDomain', latest(guid) as 'guid', latest(contentType) as 'contentType', latest(requestPath) as 'requestPath' where entityGuid = '${guid}' and sessionId = '${sessionId}' ${filter} facet timestamp ${time} limit 500", timeout: 90) {
        results
      }
      interactions: nrql(query: "FROM Mobile SELECT latest(name), latest(interactionDuration) where entityGuid = '${guid}' and category = 'Interaction' and sessionId = '${sessionId}' ${filter} facet timestamp ${time} limit 500", timeout: 90) {
        results
      }
      requestErrors: nrql(query: "FROM MobileRequestError SELECT latest(traceId) as 'traceId', latest(networkError) as 'networkError', latest(networkErrorCode) as 'networkErrorcode', latest(requestErrorFingerprint) as 'requestErrorFingerPrint', latest(errorType) as 'errorType', latest(responseTime) as 'responseTime', latest(requestMethod) as 'requestMethod', latest(requestUuid) as 'requestUuid', latest(connectionType) as 'connectionType', latest(duration) as 'duration', latest(requestUrl) as 'requestUrl', latest(requestDomain) as 'requestDomain', latest(guid) as 'guid', latest(requestPath) as 'requestPath' where entityGuid = '${guid}' and sessionId = '${sessionId}' ${filter} facet timestamp ${time} limit 500", timeout: 90) {
        results
      }
      breadcrumbs: nrql(query: "FROM MobileBreadcrumb SELECT Message, jsAppVersion, name, isFatal, errorStack, screenName where entityGuid = '${guid}' and sessionId = '${sessionId}' ${filter} ${time} limit 500", timeout: 90) {
        results
      }
    }
  }
}
`;
},
/** ******* Overview/Drilldowns *******/
}
