import React from 'react';
import { BlockText, Card, CardHeader, CardBody, HeadingText, Icon, LineChart, NerdGraphQuery, SectionMessage, Spinner, Table, TableHeader, TableHeaderCell, TableRow, TableRowCell, Tabs, TabsItem, TileGroup, Tile } from 'nr1';
import Select, { components } from 'react-select';

const query = require('./utils');

export default class HttpErrorDrilldown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorLoading: false,
      filtersSelected: [],
      errorOccurrences: [],
      errorSummary: null,
      currentOccurrence: null,
      currentIndex: 0,
      noResults: false
    };
  }

  async componentDidMount() {
    let { filters } = this.props;
    await this.getData();
    await this.setState({ filtersSelected: filters, loading: false });
  }

  async componentDidUpdate(prevProps, prevState) {
    let { filters } = this.props;

    if (prevProps.filters.length !== this.props.filters.length ||
        prevProps.time !== this.props.time) {
      await this.setState({ loading: true });
      await this.getData();
      await this.setState({ loading: false });
    }
  }

  async getData() {
    let { filters, entity, selected, time } = this.props;
    let filterString = '';
    let occurrencesQuery = '';
    let summaryQuery = '';

    if (filters.length > 0) {
      filters.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    if (selected.type == 'network') {
      occurrencesQuery = `SELECT latest(deviceUuid) as 'deviceUuid', latest(appBuild) as 'appBuild', latest(appVersion) as 'appVersion', latest(contentType) as 'contentType', latest(errorType) as 'errorType', latest(deviceGroup) as 'deviceGroup', latest(deviceManufacturer) as 'deviceManufacturer', latest(deviceModel) as 'deviceModel', latest(device) as 'deviceName', latest(deviceType) as 'deviceType', latest(osMajorVersion) as 'osMajor', latest(osName) as 'osName', latest(osVersion) as 'osVersion', latest(platform) as 'platform', latest(asn) as 'asn', latest(asnOwner) as 'asnOwner', latest(carrier) as 'carrier', latest(city) as 'city', latest(countryCode) as 'countryCode', latest(regionCode) as 'regionCode', latest(newRelicVersion) as 'nr_version', latest(sessionId) as 'sessionId', latest(requestDomain) as 'requestDomain', latest(requestMethod) as 'requestMethod', latest(requestPath) as 'requestPath', latest(responseTime) as 'responseTime', latest(networkError) as 'networkError', latest(lastInteraction) as 'lastInteraction', latest(timestamp) as 'timestamp' FROM MobileRequestError where (entityGuid = '${entity.guid}' and requestUrl = '${selected.facet[0]}' and networkError = '${selected.facet[2]}') facet requestUuid ${time} limit 1000`;
      summaryQuery = `FROM MobileRequestError SELECT uniqueCount(deviceUuid) as 'users_affected', uniques(appVersion) as 'appVersions' where (entityGuid = '${entity.guid}' and requestUrl = '${selected.facet[0]}' and networkError = '${selected.facet[2]}') ${filterString} ${time} limit 100`;
    }

    if (selected.type == 'http') {
      let statusCode = Number(selected.code);
      occurrencesQuery = `SELECT latest(deviceUuid) as 'deviceUuid', latest(appBuild) as 'appBuild', latest(appVersion) as 'appVersion', latest(contentType) as 'contentType', latest(errorType) as 'errorType',  latest(deviceGroup) as 'deviceGroup', latest(deviceManufacturer) as 'deviceManufacturer', latest(deviceModel) as 'deviceModel', latest(device) as 'deviceName', latest(deviceType) as 'deviceType', latest(osMajorVersion) as 'osMajor', latest(osName) as 'osName', latest(osVersion) as 'osVersion', latest(platform) as 'platform', latest(asn) as 'asn', latest(asnOwner) as 'asnOwner', latest(carrier) as 'carrier', latest(city) as 'city', latest(countryCode) as 'countryCode', latest(regionCode) as 'regionCode', latest(newRelicVersion) as 'nr_version', latest(sessionId) as 'sessionId', latest(requestDomain) as 'requestDomain', latest(requestMethod) as 'requestMethod', latest(requestPath) as 'requestPath', latest(responseTime) as 'responseTime', latest(lastInteraction) as 'lastInteraction', latest(timestamp) as 'timestamp' FROM MobileRequestError where (entityGuid = '${entity.guid}' and requestUrl = '${selected.facet[0]}' and statusCode = ${statusCode}) ${filterString} facet requestUuid ${time} limit 1000`;
      summaryQuery = `FROM MobileRequestError SELECT latest(responseBody) as 'response', uniqueCount(deviceUuid) as 'users_affected', uniques(appVersion) as 'appVersions' where (entityGuid = '${entity.guid}' and requestUrl = '${selected.facet[0]}' and statusCode = ${statusCode}) ${filterString} ${time} limit 100`;
    }

    let errorResp = await NerdGraphQuery.query({query: query.errorOccurrences(entity.account.id, occurrencesQuery, summaryQuery)});

    if (errorResp.error) {
      console.debug(`Failed to retrieve error occurrences for requestUrl: ${selected.facet[0]}`);
      console.debug(errorResp.error);
    } else {
      let occurrences = errorResp.data.actor.account.occurrences.results;
      let summary = errorResp.data.actor.account.summary.results;

      if (occurrences.length > 0) {
        this.setState({ errorOccurrences: occurrences, errorSummary: summary, currentOccurrence: occurrences[0], noResults: false });
      } else {
        this.setState({ noResults: true });
      }
    }
  }

  renderSummaryCard() {
    let { errorSummary } = this.state;
    let { selected } = this.props;

    return (
      <Card style={{marginRight: '10px'}}className="crashCard">
        <CardHeader title="Error Summary" />
        <CardBody>
          <div style={{marginBottom: '10px'}}>
            <h4>Error</h4><BlockText>{selected.code}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Request URL</h4><BlockText>{selected.facet[0]}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Affected Versions</h4><BlockText>{errorSummary[0].appVersions.join(",")}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Users Affected</h4><BlockText>{errorSummary[0].users_affected}</BlockText>
          </div>
          <div>
            <h4>Occurrences</h4><BlockText>{selected.occurrences}</BlockText>
          </div>
        </CardBody>
      </Card>
    )
  }

  renderCharts() {
    let { fingerPrint, filtersSelected } = this.state;
    let { entity, selected, time } = this.props;
    let filterString = '';
    let errorVersionNrql = '';

    if (filtersSelected.length > 0) {
      filtersSelected.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    if (selected.type == 'http') {
      let sc = Number(selected.code);
      errorVersionNrql = `SELECT count(*) FROM MobileRequestError WHERE (entityGuid = '${entity.guid}' and requestUrl = '${selected.facet[0]}' and statusCode = ${sc}) ${filterString} ${time} LIMIT 1000 TIMESERIES WHERE appVersion is not NULL FACET appVersion`;
    }

    if (selected.type == 'network') {
      errorVersionNrql = `SELECT count(*) FROM MobileRequestError WHERE (entityGuid = '${entity.guid}' and requestUrl = '${selected.facet[0]}' and networkError = '${selected.facet[2]}') ${filterString} ${time} LIMIT 1000 TIMESERIES WHERE appVersion is not NULL FACET appVersion`;
    }

    return (
      <div style={{width: '49%', marginTop: '20px', display: 'inline-block'}}>
        <h4>Occurrences by version</h4>
        <LineChart
          accountIds={[entity.account.id]}
          query={errorVersionNrql}
          fullWidth
          style={{display: 'inline-block'}}
        />
      </div>
    )
  }

  handleCycleClick(type) {
    let { errorOccurrences, currentIndex } = this.state;
    let currentItem = currentIndex;

    switch (type) {
      case 'first':
        currentItem = 0;
        break;
      case 'prev':
        if (currentIndex > 0) {
          currentItem = currentItem - 1;
        }
        break;
      case 'next':
        if (currentIndex < errorOccurrences.length - 1) {
          currentItem = currentItem + 1;
        }
        break;
      case 'last':
        currentItem = errorOccurrences.length - 1;
        break;
    }

    this.setState({currentIndex: currentItem, currentOccurrence: errorOccurrences[currentItem]});
  }

  renderExceptionCycling() {
    let { errorOccurrences, currentIndex } = this.state;
    let occurString = null;

    if (errorOccurrences.length > 1) {
      occurString = "occurrences";
    } else {
      occurString = "occurrence";
    }

    return (
      <div className="crashCycleDiv">
      <ul>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('first')}>&le;</a></li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('prev')}>&lt;</a></li>
        <li className="crashItems">{currentIndex + 1} of {errorOccurrences.length} {occurString}</li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('next')}>&gt;</a></li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('last')}>&ge;</a></li>
      </ul>
      </div>
    )
  }

  renderDetail() {
    let { errorLoading } = this.state;

    if (errorLoading) {
      return <Spinner />
    } else {
      return (
        <div style={{display: 'inline-flex'}}>
          {this.renderResponse()}
          {this.renderAttributes()}
        </div>
      )
    }
  }

  renderAttributes() {
    let { currentOccurrence } = this.state;

    let keysToIgnore = ['timestamp', 'facet'];

    if (currentOccurrence !== null) {
      return (
        <div className="exceptionAttributes">
        <HeadingText type={HeadingText.TYPE.HEADING_3}>Exception Attributes</HeadingText>
        <TileGroup>
          {
            Object.keys(currentOccurrence).map((key, i) => {
              if (!keysToIgnore.includes(key)) {
                return (
                  <Tile className="attributeValues">{<strong>{key}</strong>}: {currentOccurrence[key]}</Tile>
                );
              }
            })
          }
        </TileGroup>
        </div>
      );
    }

    return '';
  }

  renderResponse() {
    let { errorSummary } = this.state;
    let { selected } = this.props;

    if (selected.type == 'http' && errorSummary.response) {
      return (
        <div className="errorTable">
        <HeadingText type={HeadingText.TYPE.HEADING_3}>Response</HeadingText>
        <p>{errorSummary.response}</p>
        </div>
      )
    }

    return (
      <div className="errorTable">
      <HeadingText type={HeadingText.TYPE.HEADING_3}>Response</HeadingText>
      <p>Network failures do not have responses. A network failure occurs when no response is received.</p>
      </div>
    );
  }

  render() {
    let { loading, noResults } = this.state;

    if (loading) {
      return <Spinner />
    } else {
      return (
        <>
          {
            !loading && !noResults ?
            <>
            <br />
            {this.renderSummaryCard()}
            {this.renderCharts()}
            <br />
            <hr style={{marginTop: '2%'}}/>
            {this.renderExceptionCycling()}
            {this.renderDetail()}
            </>
            :
            <>
            <br />
            <p>There is no data for this filter and time window. If you are using the latest mobile agent try removing filters or expanding your time window</p>
            </>
          }
        </>
      )
    }
  }
}
