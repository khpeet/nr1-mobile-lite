import React from 'react';
import { PlatformStateContext } from 'nr1';
import Splash from './splash';

export default class Home extends React.Component {
  render() {
    return (
      <>
        <PlatformStateContext.Consumer>
          {platformUrlState => {
            let since = '';
            let rawTime = null;
            if (platformUrlState && platformUrlState.timeRange) {
              if (platformUrlState.timeRange.duration) {
                since = ` SINCE ${platformUrlState.timeRange.duration /
                  60 /
                  1000} MINUTES AGO`;
                rawTime = {durationMs: platformUrlState.timeRange.duration};
              } else if (
                platformUrlState.timeRange.begin_time &&
                platformUrlState.timeRange.end_time
              ) {
                since = ` SINCE ${platformUrlState.timeRange.begin_time} until ${platformUrlState.timeRange.end_time}`;
                rawTime = {startTime: platformUrlState.timeRange.begin_time, endTime: platformUrlState.timeRange.end_time};
              }
            }
            return (
              <Splash time={since} rawTime={rawTime} />
            )
          }}
        </PlatformStateContext.Consumer>
      </>
    )
  }
}
