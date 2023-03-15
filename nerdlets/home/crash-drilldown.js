import React from 'react';
import { BlockText, Card, CardHeader, CardBody, HeadingText, Icon, LineChart, NerdGraphQuery, SectionMessage, Spinner, Table, TableHeader, TableHeaderCell, TableRow, TableRowCell, Tabs, TabsItem, TileGroup, Tile } from 'nr1';
import Select, { components } from 'react-select';
import { Timeline, TimelineEvent } from 'react-event-timeline';

const query = require('./utils');

export default class CrashDrilldown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      occurrenceLoading: false,
      filtersSelected: [],
      crashOccurrences: [],
      fingerPrint: null,
      currentOccurrence: null,
      currentIndex: 0,
      occurrenceDetail: null,
      showAllInteractions: false,
      eventContentCollapsed: true,
      noResults: false
    };
  }

  async componentDidMount() {
    let { filters } = this.props;
    await this.getData();
    await this.getOccurrenceData();
    await this.setState({ filtersSelected: filters, loading: false });
  }

  async componentDidUpdate(prevProps, prevState) {
    let { filters } = this.props;

    if (prevProps.filters.length !== this.props.filters.length ||
        prevProps.time !== this.props.time) {
      await this.setState({ loading: true });
      await this.getData();
      await this.getOccurrenceData();
      await this.setState({ loading: false });
    }

    if (prevState.currentOccurrence && prevState.currentOccurrence.sessionId) {
      if (prevState.currentOccurrence.sessionId !== this.state.currentOccurrence.sessionId) {
        await this.setState({ occurrenceLoading: true });
        await this.getOccurrenceData();
        await this.setState({ occurrenceLoading: false });
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

    let fpResponse = await NerdGraphQuery.query({query: query.mobileFingerprint(entity.account.id, time, entity.guid, filterString, selected.facet[1], selected.facet[0])});

    if (fpResponse.error) {
      console.debug(`Failed to retrieve crash fingerPrint for crashLocation: ${selected.facet[0]} within entity: ${entity.name}`);
      console.debug(fpResponse);
    } else {
      let fingerprint = fpResponse.data.actor.account.fingerPrint.results;

      if (fingerprint.length > 0) {
        let occurrencesResp = await NerdGraphQuery.query({query: query.crashOccurrences(entity.account.id, time, filterString, fingerprint[0].fp)});

        if (occurrencesResp.error) {
          console.debug(`Failed to retrieve crash occurrences for crashLocation: ${selected.facet[0]} within entity: ${entity.name}`);
          console.debug(occurrencesResp);
        } else {
          let occurrences = occurrencesResp.data.actor.account.occurrences.results;

          if (occurrences.length > 0) {
            this.setState({ crashOccurrences: occurrences, fingerPrint: fingerprint[0].fp, currentOccurrence: occurrences[0], noResults: false});
          } else {
            this.setState({ noResults: true });
          }
        }
      }
    }
  }

  async getOccurrenceData() {
    let { entity, time } = this.props;
    let { currentOccurrence, filtersSelected } = this.state;
    let filterString = '';
    let counts = [];
    let aSingleCount = null;
    let formattedTrail = [];

    if (filtersSelected.length > 0) {
      filtersSelected.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    let occurrenceProms = [
      this.getInterationTrail(currentOccurrence, filterString, entity, time),
      this.getStackTrace(currentOccurrence, entity),
      this.getEventTrail(currentOccurrence, filterString, entity, time)
    ];

    let results = await Promise.all(occurrenceProms);

    for (var evtType in results[2]) {
      if (results[2][evtType].results.length > 0) {
        aSingleCount = {'type': evtType, 'count': results[2][evtType].results.length };
        counts.push(aSingleCount);
        for (var e=0; e<results[2][evtType].results.length; e++) {
          results[2][evtType].results[e].type=evtType;
          formattedTrail.push(results[2][evtType].results[e]);
        }
      }
    }


    await formattedTrail.sort((a, b) => {
      return Number(b.timestamp) - Number(a.timestamp);
    });


    await this.setState({ occurrenceDetail: results, eventTrailCounts: counts, eventTrail: formattedTrail });
  }

  async getInterationTrail(co, cf, e, t) {
    let { currentOccurrence } = this.state;
    let interactionHistory = null;
    let formattedHistory = [];

    let res = await NerdGraphQuery.query({ query: query.interactionTrail(e.account.id, t, cf, co.facet[0])});

    if (res.error && res !== undefined) {
      console.debug(`Failed to retrieve interaction trail for occurrence: ${co}`);
      console.debug(res);
    } else {
      interactionHistory = JSON.parse(res.data.actor.account.interactionTrail.results[0]['latest.interactionHistory']);
      if (interactionHistory !== null) {
        Object.keys(interactionHistory).forEach((key, i) => {
          let duration = currentOccurrence.timestamp - Number(key)
          formattedHistory.push({'name': interactionHistory[key], 'duration': duration});
        })

        await formattedHistory.sort((a, b) => {
          if (a.name !== 'Session Start') {
            return b.duration - a.duration;
          }
        });
      }
    }


    return formattedHistory;
  }

  async getStackTrace(co, e) { //LIMIT: can only fetch traces in past 60 minutes
    // let { rawTime } = this.props;
    let stackTrace = null;

    let res = await NerdGraphQuery.query({ query: query.stackTrace(e.guid, co.facet[0])});

    if (res.error) {
      console.debug(`Failed to retrieve stack trace for occurrence: ${co}`);
      console.debug(res);
    } else {
      stackTrace = res.data.actor.entity.crash.stackTrace.frames;
    }

    return stackTrace;
  }

  async getEventTrail(co, cf, e, t) {
    let eventTrail = null;

    let res = await NerdGraphQuery.query({ query: query.eventTrail(e.account.id, e.guid, t, cf, co.sessionId)});

    if (res.error) {
      console.debug(`Failed to retrieve event trail for occurrence: ${co.sessionId}`);
      console.debug(res);
    } else {
      eventTrail = res.data.actor.account;
      delete eventTrail.id;
      delete eventTrail.__typename;
    }

    return eventTrail;
  }

  renderSummaryCard() {
    let { selected } = this.props;

    return (
      <Card style={{marginRight: '10px'}}className="crashCard">
        <CardHeader title="Crash Summary" />
        <CardBody>
          <div style={{marginBottom: '10px'}}>
            <h4>Location</h4><BlockText>{selected.facet[0]}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Exception</h4><BlockText>{selected.Exception}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Message</h4><BlockText>{selected.message}</BlockText>
          </div>
          <div style={{marginBottom: '10px'}}>
            <h4>Version</h4><BlockText>{selected.facet[1]}</BlockText>
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

    let crashTimeseriesNrql = `SELECT count(*) as 'Total Crash count', filter(count(*), WHERE crashFingerprint = '${fingerPrint}' AND appVersion = '${selected.facet[1]}') as 'Filtered Crash count' FROM MobileCrash ${filterString} TIMESERIES ${time} LIMIT 1000`

    return (
      <div style={{width: '49%', marginTop: '20px', display: 'inline-block'}}>
        <h4>Crash Occurrences</h4>
        <LineChart
          accountIds={[entity.account.id]}
          query={crashTimeseriesNrql}
          fullWidth
          style={{display: 'inline-block'}}
        />
      </div>
    )
  }

  handleCycleClick(type) {
    let { crashOccurrences, currentIndex } = this.state;
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
        if (currentIndex < crashOccurrences.length - 1) {
          currentItem = currentItem + 1;
        }
        break;
      case 'last':
        currentItem = crashOccurrences.length - 1;
        break;
    }

    this.setState({currentIndex: currentItem, currentOccurrence: crashOccurrences[currentItem]});
  }

  renderCrashCycling() {
    let { crashOccurrences, currentIndex } = this.state;
    let occurString = null;

    if (crashOccurrences.length > 1) {
      occurString = "occurrences";
    } else {
      occurString = "occurrence";
    }

    return (
      <div className="crashCycleDiv">
      <ul>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('first')}>&le;</a></li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('prev')}>&lt;</a></li>
        <li className="crashItems">{currentIndex + 1} of {crashOccurrences.length} {occurString}</li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('next')}>&gt;</a></li>
        <li className="crashItems"><a onClick={() => this.handleCycleClick('last')}>&ge;</a></li>
      </ul>
      </div>
    )
  }

  renderStackTraceAndEventTrail() {
    let { occurrenceDetail, occurrenceLoading } = this.state;

    if (occurrenceLoading) {
      return <Spinner />
    } else {
      return (
        <div>
          <Tabs defaultValue="stackTrace">
            <TabsItem value="stackTrace" label="Stack trace and interaction trail">
            {this.renderInteractionTrail()}
            <div style={{display: 'inline-flex'}}>
            {this.renderStackTrace()}
            {this.renderAttributes()}
            </div>
            </TabsItem>
            <TabsItem value="eventTrail" label="Event trail">
            {this.renderEventTrail()}
            </TabsItem>
          </Tabs>
        </div>
      )
    }
  }

  renderEventTrail() {
    let { currentOccurrence, eventTrail, eventContentCollapsed } = this.state;
    let { selected } = this.props;

    if (currentOccurrence !== null) {
      return (
        <div>
          <Timeline>
            <TimelineEvent
              createdAt={<h4>{new Date(currentOccurrence.timestamp).toLocaleString()}</h4>}
              icon={<Icon type={Icon.TYPE.INTERFACE__SIGN__TIMES}/>}
              iconColor='red'
              contentStyle={{color: 'red'}}
            >
            <Card>
              <CardHeader title={<h5>Crash: {currentOccurrence.crashMessage == null ? selected.facet[0] : currentOccurrence.crashMessage}</h5>}/>
            </Card>
            </TimelineEvent>
            {
              eventTrail.map((e, i) => {
                let ts = Number(e.timestamp);
                let icon = null;
                let color = null;
                let title = null;

                let content = <CardBody>
                <div className="attributes">
                <TileGroup>
                  {
                    Object.keys(e).map((key, i) => {
                      if (key !== 'facet') {
                        return (
                          <Tile className="attributeValues">{<strong>{key}</strong>}: {key == 'duration' || key == 'responseTime' ? (e[key]*1000).toFixed(2) : e[key]}</Tile>
                        );
                      }
                    })
                  }
                </TileGroup>
                </div>
                </CardBody>

                switch (e.type) {
                  case 'breadcrumbs':
                    icon = <Icon type={Icon.TYPE.INTERFACE__SIGN__TIMES}/>;
                    color = 'blue';
                    break;
                  case 'interactions':
                    icon = <Icon type={Icon.TYPE.INTERFACE__OPERATIONS__SELECTION}/>;
                    color = 'green';
                    title = `${e['latest.name']}`;
                    break;
                  case 'requestErrors':
                    icon = <Icon type={Icon.TYPE.INTERFACE__SIGN__EXCLAMATION}/>;
                    color = 'orange';
                    break;
                  case 'requests':
                    icon = <Icon type={Icon.TYPE.INTERFACE__SIGN__CHECKMARK}/>;
                    color = 'purple';
                    let d = e.duration*1000
                    title = `HTTPResponse: ${e.statusCode}\n
                    ${e.requestUrl}\n
                    ${Math.round(d)}ms
                    `;
                    break;
                }

                return (
                  <TimelineEvent
                  createdAt={<h4>{new Date(ts).toLocaleString()}</h4>}
                  icon={icon}
                  iconColor={color}
                  contentStyle={{color: color}}
                  >
                  <Card collapsible defaultCollapsed={true}>
                    <CardHeader title={<strong><h5 style={{'whiteSpace': 'pre-line'}}>{title}</h5></strong>}/>
                    {content}
                  </Card>
                  </TimelineEvent>
                )
              })
            }
          </Timeline>
        </div>
      )
    }

    return '';


  }

  renderAttributes() {
    let { currentOccurrence } = this.state;

    let keysToIgnore = ['timestamp', 'facet', 'latest.appBuild'];

    if (currentOccurrence !== null) {
      return (
        <div className="attributes">
        <HeadingText type={HeadingText.TYPE.HEADING_3}>Crash Attributes</HeadingText>
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
    let { occurrenceDetail } = this.state;

    const headers = [
      {key: 'Name', value: ({ item }) => item.name},
      {key: 'Location', value: ({ item }) => item.formatted}
    ];

    if (occurrenceDetail[1] !== null) {
      if (occurrenceDetail[1].length > 0) {
        return (
          <div className="stackTable">
          <HeadingText type={HeadingText.TYPE.HEADING_3}>Stack Trace</HeadingText>
          <Table className="stackRow" fullWidth items={occurrenceDetail[1]}>
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

  msToTime(ms) {
    let seconds = (ms / 1000).toFixed(1);
    let minutes = (ms / (1000 * 60)).toFixed(1);
    let hours = (ms / (1000 * 60 * 60)).toFixed(1);
    let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
    if (seconds < 60) return seconds + " sec before";
    else if (minutes < 60) return minutes + " min before";
    else if (hours < 24) return hours + " hrs before";
    else return days + " days before"
  }

  renderInteractionTrail() {
    let { currentOccurrence, occurrenceDetail, showAllInteractions } = this.state;
    let interactionTrail = occurrenceDetail[0];

    return (
      <div>
      <ul className="interactionList">
      <SectionMessage title="Session Start"/>
      <div style={{fontSize: '30px'}}>
      <Icon type={Icon.TYPE.INTERFACE__ARROW__ARROW_RIGHT}/>
      </div>
      {
        interactionTrail == null || interactionTrail.length == 0
        ?
        ''
        :
        <>
        {
          showAllInteractions == false
          ?
          ''
          :
          interactionTrail.map((item, i) => {
            return (
              <>
              <SectionMessage type={SectionMessage.TYPE.SUCCESS} title={item.name} description={this.msToTime(item.duration)}/>
              <div style={{fontSize: '30px'}}>
              <Icon type={Icon.TYPE.INTERFACE__ARROW__ARROW_RIGHT}/>
              </div>
              </>
            )
          })
        }
        </>
      }
      <SectionMessage type={SectionMessage.TYPE.CRITICAL} title="Crash" description={new Date(currentOccurrence.timestamp).toLocaleString()}/>
      </ul>
      {
        interactionTrail == null || interactionTrail.length == 0
        ?
        ''
        :
        <a onClick={() => this.setState({ showAllInteractions: !showAllInteractions })}>{showAllInteractions ? 'Collapse ' : 'Expand '} {occurrenceDetail[0].length} interactions</a>
      }
      </div>
    )
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
            {this.renderCrashCycling()}
            {this.renderStackTraceAndEventTrail()}
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
