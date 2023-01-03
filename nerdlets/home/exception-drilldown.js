import React from 'react';
import { BlockText, Card, CardHeader, CardBody, HeadingText, Icon, LineChart, NerdGraphQuery, SectionMessage, Spinner, Table, TableHeader, TableHeaderCell, TableRow, TableRowCell, Tabs, TabsItem, TileGroup, Tile } from 'nr1';
import Select, { components } from 'react-select';

const query = require('./utils');

export default class ExceptionDrilldown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      exceptionLoading: false,
      filtersSelected: [],
      exceptionOccurrences: [],
      fingerPrint: null,
      currentOccurrence: null,
      currentIndex: 0,
      stackTrace: null,
      noResults: false
    };
  }

  async componentDidMount() {
    let { filters } = this.props;
    await this.getData();
    await this.getStackTrace();
    await this.setState({ filtersSelected: filters, loading: false });
  }

  async componentDidUpdate(prevProps, prevState) {
    let { filters } = this.props;

    if (prevProps.filters.length !== this.props.filters.length ||
        prevProps.time !== this.props.time) {
      await this.setState({ loading: true });
      await this.getData();
      await this.getStackTrace();
      await this.setState({ loading: false });
    }

    if (prevState.currentOccurrence && prevState.currentOccurrence.sessionId) {
      if (prevState.currentOccurrence.sessionId !== this.state.currentOccurrence.sessionId) {
        await this.setState({ exceptionLoading: true });
        await this.getStackTrace();
        await this.setState({ exceptionLoading: false });
      }
    }
  }

  async getData() {
    let { filters, entity, selected, time } = this.props;
    let filterString = '';

    if (filters.length > 0) {
      filters.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    let fpResponse = await NerdGraphQuery.query({query: query.exceptionFingerprint(entity.account.id, time, entity.guid, filterString, selected.exceptionLocation)});

    if (fpResponse.error) {
      console.debug(`Failed to retrieve exception fingerPrint for exceptionLocation: ${selected.facet[0]} within entity: ${entity.name}`);
    } else {
      let fingerprint = fpResponse.data.actor.account.fingerPrint.results;

      if (fingerprint.length > 0) {
        let occurrencesResp = await NerdGraphQuery.query({query: query.exceptionOccurrences(entity.account.id, time, filterString, fingerprint[0].fp)});

        if (occurrencesResp.error) {
          console.debug(`Failed to retrieve exception occurrences for exceptionLocation: ${selected.facet[0]} within entity: ${entity.name}`);
        } else {
          let occurrences = occurrencesResp.data.actor.account.occurrences.results;

          if (occurrences.length > 0) {
            this.setState({ exceptionOccurrences: occurrences, fingerPrint: fingerprint[0].fp, currentOccurrence: occurrences[0], noResults: false});
          } else {
            this.setState({ noResults: true });
          }
        }
      }
    }
  }

  async getStackTrace() { //LIMIT: can only fetch traces in past 60 minutes
    let { entity, time } = this.props;
    let { currentOccurrence } = this.state;
    let stackTrace = null;

    let res = await NerdGraphQuery.query({ query: query.exceptionStackTrace(entity.guid, currentOccurrence.facet[0])});

    if (res.error) {
      console.debug(`Failed to retrieve stack trace for occurrence: ${currentOccurrence.facet[0]}`);
      console.debug(res.error)
    } else {
      stackTrace = res.data.actor.entity.exception.stackTrace.frames;
    }

    this.setState({stackTrace: stackTrace});
  }

  renderSummaryCard() {
    let { selected } = this.props;

    return (
      <Card style={{marginRight: '10px'}}className="crashCard">
        <CardHeader title="Handled Exception Summary" />
        <CardBody>
          <div style={{marginBottom: '10px'}}>
            <h4>Location</h4><BlockText>{selected.exceptionLocation}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Exception</h4><BlockText>{selected.name}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Message</h4><BlockText>{selected.message}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Users Affected</h4><BlockText>{selected['Users Affected']}</BlockText>
          </div>
          <div>
            <h4>Occurrences</h4><BlockText>{selected.count}</BlockText>
          </div>
        </CardBody>
      </Card>
    )
  }

  renderCharts() {
    let { fingerPrint, filtersSelected } = this.state;
    let { entity, selected, time } = this.props;
    let filterString = '';

    if (filtersSelected.length > 0) {
      filtersSelected.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    let exceptionTimeseriesNrql = `SELECT count(*) FROM MobileHandledException WHERE exceptionLocation = '${selected.exceptionLocation}' and fingerprint = '${fingerPrint}' and appVersion is not null ${filterString} ${time} LIMIT 1000 TIMESERIES FACET appVersion`;

    return (
      <div style={{width: '49%', marginTop: '20px', display: 'inline-block'}}>
        <h4>Occurrences by version</h4>
        <LineChart
          accountIds={[entity.account.id]}
          query={exceptionTimeseriesNrql}
          fullWidth
          style={{display: 'inline-block'}}
        />
      </div>
    )
  }

  handleCycleClick(type) {
    let { exceptionOccurrences, currentIndex } = this.state;
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
        if (currentIndex < exceptionOccurrences.length - 1) {
          currentItem = currentItem + 1;
        }
        break;
      case 'last':
        currentItem = exceptionOccurrences.length - 1;
        break;
    }

    this.setState({currentIndex: currentItem, currentOccurrence: exceptionOccurrences[currentItem]});
  }

  renderExceptionCycling() {
    let { exceptionOccurrences, currentIndex } = this.state;
    let occurString = null;

    if (exceptionOccurrences.length > 1) {
      occurString = "occurrences";
    } else {
      occurString = "occurrence";
    }

    return (
      <div className="crashCycleDiv">
      <ul>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('first')}>&le;</a></li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('prev')}>&lt;</a></li>
        <li className="crashItems">{currentIndex + 1} of {exceptionOccurrences.length} {occurString}</li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('next')}>&gt;</a></li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('last')}>&ge;</a></li>
      </ul>
      </div>
    )
  }

  renderDetail() {
    let { exceptionLoading } = this.state;

    if (exceptionLoading) {
      return <Spinner />
    } else {
      return (
        <div style={{display: 'inline-flex'}}>
          {this.renderStackTrace()}
          {this.renderAttributes()}
        </div>
      )
    }
  }

  renderAttributes() {
    let { currentOccurrence } = this.state;

    let keysToIgnore = ['timestamp', 'facet', 'latest.appBuild'];

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

  renderStackTrace() {
    let { stackTrace } = this.state;

    const headers = [
      {key: 'Name', value: ({ item }) => item.name},
      {key: 'Location', value: ({ item }) => item.formatted}
    ];

    if (stackTrace !== null) {
      if (stackTrace.length > 0) {
        return (
          <div className="stackTable">
          <HeadingText type={HeadingText.TYPE.HEADING_3}>Stack Trace</HeadingText>
          <Table className="stackRow" fullWidth items={stackTrace}>
          <TableHeader>
            {headers.map((h, i) => (
              <TableHeaderCell
              {...h}
              >
              {h.key}
              </TableHeaderCell>
            ))}
          </TableHeader>

          {({ item }) => {
            return (
              <TableRow>
                <TableRowCell>{item.name}</TableRowCell>
                <TableRowCell>{item.formatted}</TableRowCell>
              </TableRow>
            )
          }}
          </Table>
          </div>
        );
      }
    }

    return '';
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
