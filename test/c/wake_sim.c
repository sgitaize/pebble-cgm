// Simulation of the watch-side wake timer with fake time and timers: test/run.sh
#include <stdlib.h>
static long g_now = 1000000;
#include <time.h>
static time_t fake_time(time_t *p) { (void)p; return g_now / 1000; }
#include "pebble.h"
#define time(x) fake_time(x)
#include "pebble.h"
struct AppTimer { long at; AppTimerCallback cb; int live; };
static struct AppTimer T[64]; static int nT;
AppTimer* app_timer_register(uint32_t ms, AppTimerCallback cb, void *d){(void)d; T[nT]=(struct AppTimer){g_now+ms,cb,1}; return &T[nT++];}
void app_timer_cancel(AppTimer*t){t->live=0;}
Tuple *dict_find(DictionaryIterator*i, uint32_t k){(void)i;(void)k;return NULL;}
AppMessageResult app_message_outbox_begin(DictionaryIterator**i){*i=(void*)1;return APP_MSG_OK;}
AppMessageResult app_message_outbox_send(void){return APP_MSG_OK;}
int dict_write_uint8(DictionaryIterator*a, uint32_t b, uint8_t c){(void)a;(void)b;(void)c;return 0;}
bool persist_exists(uint32_t k){(void)k;return 0;} int persist_read_data(uint32_t k, void*p, size_t n){(void)k;(void)p;(void)n;return 0;} int persist_write_data(uint32_t k,const void*p,size_t n){(void)k;(void)p;(void)n;return 0;}
void graphics_context_set_fill_color(GContext*a,GColor b){(void)a;(void)b;} void graphics_fill_circle(GContext*a,GPoint b,int c){(void)a;(void)b;(void)c;} void graphics_fill_rect(GContext*a,GRect b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
#include "../../c/cgm.c"
static long reqs[200]; static int nreq;
static void req(void){ reqs[nreq++]=g_now/1000; }
static void run_until(long t){ for(;;){ int b=-1; for(int i=0;i<nT;i++) if(T[i].live&&T[i].at<=t&&(b<0||T[i].at<T[b].at)) b=i; if(b<0)break; T[b].live=0; g_now=T[b].at; T[b].cb(NULL);} g_now=t; }
int main(void){
  cgm_wake_init(req);
  // schedule: next wake at t0+100, interval 300; nobody answers (missed)
  long t0=g_now/1000; s_next=t0+100; s_interval=300; wake_schedule();
  run_until((t0+1200)*1000L);
  printf("requests (s after t0):"); for(int i=0;i<nreq;i++) printf(" %ld",reqs[i]-t0); printf("\n");
  int search=0; for(int i=1;i<nreq;i++) if(reqs[i]-reqs[i-1]==15) search++;
  printf("search steps: %d\n", search);
  return !(search>=20 && reqs[0]-t0==103);
}
