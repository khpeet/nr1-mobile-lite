import React from 'react';
import { nerdlet, PlatformStateContext } from 'nr1';
import Splash from './splash';

export default class Home extends React.Component {

  componentDidMount() {
    nerdlet.setConfig({
      timePicker: true,
      timePickerRanges: [
        nerdlet.TIME_PICKER_RANGE.NONE,
        { label: "30 minutes", offset: 1800000 },
        { label: "60 minutes", offset: 3600000 },
        { label: "3 hours", offset: 10800000 },
        { label: "6 hours", offset: 21600000 },
        { label: "12 hours", offset: 43200000 },
        { label: "24 hours", offset: 86400000 },
        nerdlet.TIME_PICKER_RANGE.CUSTOM,
      ],
    });
  }

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
